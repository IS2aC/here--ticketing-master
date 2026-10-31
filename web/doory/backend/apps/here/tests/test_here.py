import base64
import io
from types import SimpleNamespace

import pytest
from django.core import signing
from PIL import Image
from rest_framework.test import APIClient

from apps.designs.doc import fields
from apps.designs.models import Design
from apps.exports import services as exports
from apps.exports.renderer import RenderResult
from apps.gallery.tests.factories import make_category, make_template
from apps.here import services, views

pytestmark = pytest.mark.django_db

SECRET = "secret-partage-avec-here"
HERE = "https://here.example.com"


@pytest.fixture(autouse=True)
def _here(settings):
    settings.HERE_SECRET = SECRET
    settings.HERE_APP_URL = HERE
    settings.SITE_URL = "https://studio.example.com"


@pytest.fixture
def api():
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {SECRET}")
    return client


def _create(api, **extra):
    body = {"organizer": {"id": "org-1", "name": "Aya Koffi"}, "title": "Mariage Aya & Koffi", **extra}
    response = api.post("/api/v1/here/designs/", body, format="json")
    assert response.status_code == 201, response.content
    return Design.objects.get(pk=response.json()["id"])


def _keys(document):
    return sorted(tag["key"] for _page, _obj, tag in fields.tagged(document))


def test_refused_without_the_secret(settings):
    assert APIClient().post("/api/v1/here/designs/", {}, format="json").status_code in (401, 403)
    wrong = APIClient()
    wrong.credentials(HTTP_AUTHORIZATION="Bearer autre")
    assert wrong.get("/api/v1/here/templates/").status_code in (401, 403)
    settings.HERE_SECRET = ""
    assert APIClient().get("/api/v1/here/templates/").status_code == 404


def test_blank_card_has_the_guest_fields(api):
    design = _create(api)
    assert (design.width, design.height) == (1080, 1350)
    assert _keys(design.document) == ["nom_invite", "qr_code", "table_invite"]
    assert design.owner.email == "here-org-1@here.invalid"
    assert design.owner.display_name == "Aya Koffi"
    assert not design.owner.has_usable_password()
    # Same organizer, same Doory user.
    assert _create(api).owner_id == design.owner_id


def test_card_from_a_template_keeps_its_own_guest_fields(api):
    template = make_template(
        "Invitation doree", width=1080, height=1350, category=make_category("Invitations")
    )
    template.document["pages"][0]["objects"].append(
        {
            "id": "n",
            "type": "textbox",
            "text": "Nom",
            "left": 0,
            "top": 0,
            "width": 100,
            "height": 40,
            "field": {"key": "nom_invite", "type": "text"},
        }
    )
    template.save()
    design = _create(api, template=template.slug)
    assert _keys(design.document) == ["nom_invite", "qr_code", "table_invite"]
    listed = api.get("/api/v1/here/templates/?category=invitations").json()
    assert [t["slug"] for t in listed] == [template.slug]


def test_session_link_signs_in_and_opens_the_card(api):
    design = _create(api)
    response = api.post(
        f"/api/v1/here/designs/{design.pk}/session/",
        {"organizer_id": "org-1", "return_url": f"{HERE}/tableau-de-bord/evenements/1/carte"},
        format="json",
    )
    assert response.status_code == 200, response.content
    url = response.json()["url"]
    assert url.startswith("https://studio.example.com/api/v1/here/session/?t=")

    browser = APIClient()
    opened = browser.get(url.removeprefix("https://studio.example.com"))
    assert opened.status_code == 302 and opened["Location"] == f"/design/{design.pk}"
    assert browser.get("/api/v1/auth/me/").json()["user"]["email"] == "here-org-1@here.invalid"
    assert browser.get("/api/v1/here/return/").json()["url"] == f"{HERE}/tableau-de-bord/evenements/1/carte"


def test_session_link_refuses_other_sites_and_other_organizers(api):
    design = _create(api)
    path = f"/api/v1/here/designs/{design.pk}/session/"
    elsewhere = api.post(path, {"organizer_id": "org-1", "return_url": "https://evil.example"}, format="json")
    assert elsewhere.status_code == 400
    assert api.post(path, {"organizer_id": "org-2"}, format="json").status_code == 404


def test_session_refuses_a_forged_or_old_link(api):
    assert APIClient().get("/api/v1/here/session/?t=abc").status_code == 400
    forged = signing.dumps({"user": "x", "design": "y", "return": HERE}, key="autre", salt=views.SESSION_SALT)
    assert APIClient().get(f"/api/v1/here/session/?t={forged}").status_code == 400


def test_render_leaves_the_guest_fields_out_and_says_where_they_are(api, monkeypatch):
    design = _create(api)
    drawn = {}

    def fake_export(stand_in, **options):
        drawn["objects"] = stand_in.document["pages"][0]["objects"]
        drawn["options"] = options
        return SimpleNamespace(data=b"jpeg", warnings=())

    monkeypatch.setattr(services, "export_image", fake_export)
    response = api.post(f"/api/v1/here/designs/{design.pk}/render/", {"organizer_id": "org-1"}, format="json")
    assert response.status_code == 200, response.content
    body = response.json()
    assert base64.b64decode(body["image"]) == b"jpeg"
    assert drawn["objects"] == []
    assert drawn["options"]["size"] == "1080w"
    assert set(body["fields"]) == {"nom_invite", "table_invite", "qr_code"}
    name = body["fields"]["nom_invite"]
    assert (name["width"], name["font_size"], name["align"], name["bold"]) == (880, 64, "center", True)
    assert name["left"] == 100
    qr = body["fields"]["qr_code"]
    assert (qr["left"], qr["top"], qr["width"], qr["height"]) == (780, 1050, 240, 240)


def test_render_goes_through_the_real_image_export(api, settings, monkeypatch):
    """Only the browser is replaced: the stand-in design must have everything the export reads."""
    settings.SERVER_IMAGE_EXPORT_ENABLED = True
    design = _create(api)
    drawn = {}

    def fake_browser(payload, *, render_url, timeout=None):
        drawn["payload"] = payload
        out = io.BytesIO()
        Image.new("RGB", (1080, 1350), (250, 240, 230)).save(out, "PNG")
        page = payload["document"]["pages"][payload["page"]]
        return RenderResult(
            data=out.getvalue(), mime="image/png", width=1080, height=1350, page_id=page["id"], page_index=0
        )

    monkeypatch.setattr(exports, "render_image", fake_browser)
    body = services.render_card(design)
    assert drawn["payload"]["document"]["pages"][0]["objects"] == []
    image = Image.open(io.BytesIO(base64.b64decode(body["image"])))
    assert image.format == "JPEG" and image.size == (1080, 1350)
    assert (body["width"], body["height"]) == (1080, 1350)
