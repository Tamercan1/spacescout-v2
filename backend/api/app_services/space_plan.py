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

        new_discovery = Discovery.objects.create(
            space_plan=plan,
            source=discovery.type,
            type=discovery.type,
            title=discovery.title,
            date=date.fromisoformat(discovery.date) if discovery.date else None, # Convert date to YYYY-MM-DD format or None
            summary=discovery.summary,
            why_interesting=discovery.why_interesting,
            facts=discovery.facts,
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