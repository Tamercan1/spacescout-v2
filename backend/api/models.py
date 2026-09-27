import uuid
from django.db import models
from django.db.models import Q
from django.conf import settings
from django.contrib.auth.models import AbstractUser

# Create your models here.

class User(AbstractUser):
    pass


class UserProfile(models.Model):
    THEME_CHOICES = [
        ("light", "Light"),
        ("dark", "Dark"),
        ("system", "System"),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
   
    preferred_model = models.CharField(max_length=150, blank=True)
    theme = models.CharField(max_length=20, choices=THEME_CHOICES, default="system")

    onboarding_completed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username}'s profile"


class ProviderCredential(models.Model):
    PROVIDER_CHOICES = [
        ("openrouter", "OpenRouter"),
        ("nasa", "NASA"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='provider_credentials')
    provider = models.CharField(max_length=200, choices=PROVIDER_CHOICES)
    encrypted_key = models.TextField()
    key_hint = models.CharField(max_length=10, blank=True)
    is_valid = models.BooleanField(null=True, blank=True)
    last_validated_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "provider"],
                name="unique_user_provider_credential"
            ),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.provider}"


class SpacePlan(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="space_plans")
    title = models.CharField(max_length=250)
    prompt = models.TextField()
    summary = models.TextField(blank=True)
    status = models.CharField(choices=STATUS_CHOICES, default='pending')
    is_archived = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title


class Discovery(models.Model):
    SOURCE_CHOICES = [
        ("apod", "Astronomy Picture of the Day"),
        ("neows", "Near Earth Object Web Service"),
        ("donki", "DONKI"),
    ]

    space_plan = models.ForeignKey(SpacePlan, on_delete=models.CASCADE, related_name="discoveries")

    source = models.CharField(max_length=50, choices=SOURCE_CHOICES)
    external_id = models.CharField(max_length=255, null=True, blank=True)
    source_url = models.URLField(max_length=2000, blank=True)

    type = models.CharField(max_length=50)
    title = models.CharField(max_length=500)

    date = models.DateField(null=True, blank=True)

    summary = models.TextField()
    why_interesting = models.TextField(blank=True)
    facts = models.JSONField(default=list, blank=True)
    tags = models.JSONField(default=list, blank=True)
    details = models.JSONField(default=dict, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    first_discovered_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'first_discovered_at']
        constraints = [
            models.UniqueConstraint(
                fields=["space_plan", "source", "external_id"],
                condition=Q(external_id__isnull=False),
                name="unique_plan_source_external_id",
            ),
        ]
        indexes = [
            models.Index(
                fields=['space_plan', 'sort_order'],
                name="discovery_plan_order_idx",
            )
        ]


    def __str__(self):
        return self.title


class DiscoveryMedia(models.Model):
    MEDIA_TYPE_CHOICES = [
        ("image", "Image"),
        ("video", "Video"),
        ("other", "Other"),
    ]

    discovery = models.ForeignKey(Discovery, on_delete=models.CASCADE, related_name="media")
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES)
    url = models.URLField(max_length=2000)
    thumbnail_url = models.URLField(max_length=2000, blank=True,)
    caption = models.TextField(max_length=2000, blank=True)
    is_primary = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']
        constraints = [
            models.UniqueConstraint(
                fields=['discovery'],
                condition=Q(is_primary=True),
                name='unique_primary_discovery_media',
            ),
        ]

    def __str__(self):
        return f"{self.discovery.title} - {self.media_type}"
    

class Interaction(models.Model):
    INTERACTION_TYPE_CHOICES = [
        ("find_more", "Find More"),
        ("enrich", "Tell Me More"),
        ("compare", "Compare"),
        ("related", "Find Related"),
        ("other", "Other"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    space_plan = models.ForeignKey(SpacePlan, on_delete=models.CASCADE, related_name="interactions")

    user_prompt = models.TextField()
    interaction_type = models.CharField(max_length=20, choices=INTERACTION_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    response = models.JSONField(default=dict, blank=True)
    error_code = models.CharField(max_length=100, blank=True)

    target_discoveries = models.ManyToManyField(Discovery, blank=True, related_name="targeted_by_interactions")
    added_discoveries = models.ManyToManyField(Discovery, blank=True, related_name="introduced_by_interactions")

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True,)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.space_plan.title} - {self.interaction_type}"