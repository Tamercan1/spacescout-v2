from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User, UserProfile, ProviderCredential,
    SpacePlan, Discovery, DiscoveryMedia, Interaction,
)

# register your models here
admin.site.register(User, UserAdmin)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "theme", "preferred_model", "created_at")
    list_filter = ("theme",)
    search_fields = ("user__username",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(ProviderCredential)
class ProviderCredentialAdmin(admin.ModelAdmin):
    list_display = ("user", "provider", "key_hint", "is_valid", "last_validated_at")
    list_filter = ("provider", "is_valid")
    search_fields = ("user__username",)
    readonly_fields = ("created_at", "updated_at")
    exclude = ("encrypted_key",)


@admin.register(SpacePlan)
class SpacePlanAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "status", "is_archived", "created_at", "updated_at")
    list_filter = ("user", "status", "is_archived", "created_at")
    search_fields = ("title", "prompt", "summary")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Discovery)
class DiscoveryAdmin(admin.ModelAdmin):
    list_display = ("title", "space_plan", "source", "type", "date")
    list_filter = ("source", "type", "date")
    search_fields = ("title", "summary", "why_interesting")
    readonly_fields = ("first_discovered_at", "updated_at")


@admin.register(DiscoveryMedia)
class DiscoveryMediaAdmin(admin.ModelAdmin):
    list_display = ("discovery", "media_type", "is_primary", "order")
    list_filter = ("media_type", "is_primary")
    readonly_fields = ("id",)


@admin.register(Interaction)
class InteractionAdmin(admin.ModelAdmin):
    list_display = ("space_plan", "interaction_type", "status", "created_at", "completed_at")
    list_filter = ("interaction_type", "status")
    search_fields = ("user_prompt",)
    readonly_fields = ("id", "created_at")
