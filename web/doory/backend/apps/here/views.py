"""Here!: the calls of the Here! API (signed with `HERE_SECRET`) and the editor's sign-in link."""

from __future__ import annotations

import hmac
import re
from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.core import signing
from django.http import Http404, HttpResponseBadRequest, HttpResponseRedirect, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import serializers
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.designs.models import Design
from apps.gallery.models import Template

from . import services

SESSION_SALT = "apps.here.session"
SESSION_MAX_AGE = 120  # seconds: the link is opened by the organizer's browser right after Here! made it
RETURN_KEY = "here_return_url"
ORGANIZER_ID = re.compile(r"^[A-Za-z0-9-]{1,64}$")


def enabled() -> bool:
    return bool(settings.HERE_SECRET)


class HereServer(BasePermission):
    """The caller is the Here! API: `Authorization: Bearer <HERE_SECRET>`."""

    def has_permission(self, request, view) -> bool:
        if not enabled():
            raise Http404
        given = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
        return hmac.compare_digest(given.encode(), settings.HERE_SECRET.encode())


# Server-to-server routes (no browser session, so no CSRF): left out of the public API schema.
INTERNAL = extend_schema_view(get=extend_schema(exclude=True), post=extend_schema(exclude=True))


class HereView(APIView):
    authentication_classes: list = []
    permission_classes = [HereServer]
    throttle_classes: list = []


class OrganizerSerializer(serializers.Serializer):
    id = serializers.RegexField(ORGANIZER_ID)
    name = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")


class DesignCreateSerializer(serializers.Serializer):
    organizer = OrganizerSerializer()
    title = serializers.CharField(max_length=200)
    template = serializers.SlugField(max_length=120, required=False, allow_null=True, default=None)


def _design(pk, organizer_id: str) -> Design:
    user = services.organizer_user(organizer_id)
    return get_object_or_404(Design.objects.filter(owner=user, trashed_at__isnull=True), pk=pk)


def _organizer_id(request) -> str:
    value = request.data.get("organizer_id") or request.query_params.get("organizer_id", "")
    if not isinstance(value, str) or not ORGANIZER_ID.match(value):
        raise serializers.ValidationError({"organizer_id": "Required."})
    return value


@INTERNAL
class TemplateListView(HereView):
    """Published templates of the card size, optionally of one category (`?category=<slug>`)."""

    def get(self, request):
        templates = Template.objects.filter(is_published=True).select_related("category")
        if category := request.query_params.get("category"):
            templates = templates.filter(category__slug=category)
        return Response(
            [
                {
                    "slug": t.slug,
                    "title": t.title,
                    "category": t.category.slug if t.category else None,
                    "width": t.width,
                    "height": t.height,
                    "thumbnail": _public_url(t.thumbnail.url) if t.thumbnail else None,
                }
                for t in templates.order_by("-is_featured", "-use_count")[:60]
            ]
        )


@INTERNAL
class DesignCreateView(HereView):
    def post(self, request):
        body = DesignCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data
        user = services.organizer_user(data["organizer"]["id"], data["organizer"]["name"])
        design = services.create_card_design(user, title=data["title"], template=data["template"])
        return Response({"id": str(design.pk)}, status=201)


@INTERNAL
class SessionLinkView(HereView):
    """A sign-in link to the editor for the organizer's browser.

    `return_url` is the Here! page to go back to."""

    def post(self, request, pk):
        design = _design(pk, _organizer_id(request))
        return_url = request.data.get("return_url") or settings.HERE_APP_URL
        if not _is_here_url(return_url):
            raise serializers.ValidationError({"return_url": "Not a Here! address."})
        token = signing.dumps(
            {"user": str(design.owner_id), "design": str(design.pk), "return": return_url},
            key=settings.HERE_SECRET,
            salt=SESSION_SALT,
        )
        return Response({"url": f"{settings.SITE_URL.rstrip('/')}/api/v1/here/session/?t={token}"})


@INTERNAL
class RenderView(HereView):
    """The card without the guest fields (JPEG, base64) and where they are, to draw one card per guest."""

    def post(self, request, pk):
        return Response(services.render_card(_design(pk, _organizer_id(request))))


def _public_url(url: str) -> str:
    """An address the organizer's browser can open (Here! calls this API by its private network name)."""
    return url if url.startswith(("http://", "https://")) else f"{settings.SITE_URL.rstrip('/')}{url}"


def _is_here_url(url: str) -> bool:
    if not settings.HERE_APP_URL or not isinstance(url, str):
        return False
    here, given = urlsplit(settings.HERE_APP_URL), urlsplit(url)
    return (given.scheme, given.netloc) == (here.scheme, here.netloc)


@require_GET
def session(request):
    """Opens the editor on the card, signed in as the organizer (the link from `SessionLinkView`)."""
    if not enabled():
        raise Http404
    try:
        data = signing.loads(
            request.GET.get("t", ""), key=settings.HERE_SECRET, salt=SESSION_SALT, max_age=SESSION_MAX_AGE
        )
    except signing.BadSignature:
        return HttpResponseBadRequest("Ce lien a expiré. Revenez à Here! et ouvrez de nouveau l'éditeur.")
    user = get_object_or_404(get_user_model(), pk=data["user"], is_active=True)
    login(request, user, backend=settings.AUTHENTICATION_BACKENDS[0])
    request.session[RETURN_KEY] = data["return"]
    return HttpResponseRedirect(f"/design/{data['design']}")


@require_GET
def return_url(request):
    """The Here! page the editor's « Retour à Here! » link goes to, for the signed-in organizer."""
    url = request.session.get(RETURN_KEY) if request.user.is_authenticated else None
    return JsonResponse({"url": url or None})
