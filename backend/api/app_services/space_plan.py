from django.db import transaction
from ..models import SpacePlan, Discovery, DiscoveryMedia
from datetime import date

# =================================
# THIS IS TO SAVE THE RESULT TO DB
# =================================


@transaction.atomic
def save_space_plan(user, prompt, space_plan):
    plan = SpacePlan.objects.create(
        user=user,
        prompt=prompt,
        title=space_plan.title,
        summary=space_plan.summary,
        status='processing'
    )

    for i, discovery in enumerate(space_plan.discoveries):
        if discovery.media:
            media_type = discovery.media.media_type
            media_url = discovery.media.media_url 
        else:
            media_type = None
            media_url = None

        ext_id = None
        if discovery.type == "apod" and discovery.date:
            ext_id = discovery.date
        elif discovery.type == "nasa_images" and isinstance(discovery.facts, dict):
            ext_id = discovery.facts.get("NASA ID")
        elif discovery.type == "neows" and isinstance(discovery.facts, dict):
            ext_id = discovery.facts.get("Neo Reference ID") or discovery.facts.get("id")
        elif discovery.type == "donki" and isinstance(discovery.facts, dict):
            ext_id = discovery.facts.get("Flare ID") or discovery.facts.get("id")
        elif discovery.type == "epic" and isinstance(discovery.facts, dict):
            ext_id = discovery.facts.get("Image ID") or discovery.facts.get("identifier")

        new_discovery = Discovery.objects.create(
            space_plan=plan,
            source=discovery.type,
            external_id=ext_id,
            type=discovery.type,
            title=discovery.title,
            date=date.fromisoformat(discovery.date) if discovery.date else None, # Convert date to YYYY-MM-DD format or None
            summary=discovery.summary,
            why_interesting=discovery.why_interesting,
            facts=discovery.facts if isinstance(discovery.facts, dict) else {},
            source_url=discovery.source,
            sort_order=i,
        )

        if media_url:
            DiscoveryMedia.objects.create(
                discovery=new_discovery,
                media_type=media_type or "other",
                url=media_url,
                is_primary=True,
            )

    plan.status = 'completed'
    plan.save(update_fields=['status'])

    return plan