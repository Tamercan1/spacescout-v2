import os
import django
import sys

# Setup django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import User, SpacePlan, Discovery, Interaction, DiscoveryMedia
from django.utils import timezone

def create_dummy_data():
    users = User.objects.all()
    if not users.exists():
        users = [User.objects.create_user(username="testuser", password="password123")]
        print("Created default user 'testuser'.")
    
    for user in users:
        print(f"Creating dummy data for user: {user.username}")

        # Create a Dummy Space Plan
        plan = SpacePlan.objects.create(
            user=user,
            prompt="Show me interesting near-earth objects from this week and related astronomy pictures.",
            title="Near-Earth Objects & Astronomy Wonders",
            summary="An exploration of recent close-approach asteroids tracked by NASA and related visual phenomena in deep space.",
            status="completed",
            is_archived=False
        )

        # Dummy Discovery 1 (NEO)
        d1 = Discovery.objects.create(
            space_plan=plan,
            source="neows",
            external_id="neo-12345",
            source_url="https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2024%20AB",
            type="neo",
            title="Asteroid 2024 AB",
            date="2024-05-12",
            summary="A near-Earth asteroid approximately 45 meters in diameter that made a close approach to Earth at 1.2 lunar distances.",
            why_interesting="This object passed within the orbit of some geostationary satellites, providing a rare opportunity for radar observation.",
            facts={"Velocity": "12.4 km/s", "Estimated Diameter": "30-50m", "Miss Distance": "460,000 km"},
            tags=["Asteroid", "Close Approach", "NEO"],
            details={},
            sort_order=1
        )

        # Dummy Discovery 2 (APOD)
        d2 = Discovery.objects.create(
            space_plan=plan,
            source="apod",
            external_id="apod-2024-05-10",
            source_url="https://apod.nasa.gov/apod/ap240510.html",
            type="image",
            title="The Magnificent Helix Nebula",
            date="2024-05-10",
            summary="A striking planetary nebula located about 700 light-years away in the constellation Aquarius. It represents the final stages of a Sun-like star's evolution.",
            why_interesting="The Helix Nebula is often referred to as the 'Eye of God' due to its distinct shape and vibrant colors, which are caused by energized gas.",
            facts={"Distance": "700 ly", "Constellation": "Aquarius", "Type": "Planetary Nebula"},
            tags=["Nebula", "Deep Space", "Star Death"],
            details={},
            sort_order=2
        )

        # Add media to APOD
        DiscoveryMedia.objects.create(
            discovery=d2,
            media_type="image",
            url="https://apod.nasa.gov/apod/image/2405/Helix_hubble_1080.jpg",
            thumbnail_url="https://apod.nasa.gov/apod/image/2405/Helix_hubble_1080.jpg",
            caption="Hubble Space Telescope view of the Helix Nebula",
            is_primary=True,
            order=1
        )

        # Dummy Interaction 1
        i1 = Interaction.objects.create(
            space_plan=plan,
            user_prompt="Are there any known risks of Asteroid 2024 AB impacting Earth in the future?",
            interaction_type="enrich",
            status="completed",
            response={
                "result_type": "analysis",
                "title": "Impact Risk Assessment for 2024 AB",
                "sections": [
                    {
                        "heading": "Current Trajectory",
                        "content": "Based on current radar observations from the Goldstone Solar System Radar, 2024 AB has a well-defined orbit that ensures it will not impact Earth for at least the next 150 years."
                    },
                    {
                        "heading": "Future Approaches",
                        "content": "The next significant close approach will occur in 2042, but it will be safely at 3.5 lunar distances."
                    }
                ]
            },
            completed_at=timezone.now()
        )
        i1.target_discoveries.add(d1)

        # Dummy Interaction 2
        i2 = Interaction.objects.create(
            space_plan=plan,
            user_prompt="Find more images like the Helix Nebula",
            interaction_type="find_more",
            status="processing",
            response={}
        )
        i2.target_discoveries.add(d2)

        print(f"Created Dummy SpacePlan ID: {plan.id} for user {user.username}")

if __name__ == "__main__":
    create_dummy_data()
