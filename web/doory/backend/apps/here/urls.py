from django.urls import path

from . import views

urlpatterns = [
    path("here/templates/", views.TemplateListView.as_view(), name="here-templates"),
    path("here/designs/", views.DesignCreateView.as_view(), name="here-designs"),
    path("here/designs/<uuid:pk>/session/", views.SessionLinkView.as_view(), name="here-session-link"),
    path("here/designs/<uuid:pk>/render/", views.RenderView.as_view(), name="here-render"),
    path("here/session/", views.session, name="here-session"),
    path("here/return/", views.return_url, name="here-return"),
]
