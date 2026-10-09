from django.db import migrations


def backfill_why_interesting(apps, schema_editor):
    Discovery = apps.get_model('api', 'Discovery')
    
    # Process discoveries where why_interesting is empty or None
    discoveries = Discovery.objects.filter(why_interesting__in=["", None])
    
    for discovery in discoveries:
        source = discovery.source or discovery.type
        title = discovery.title or "Discovery"
        summary = discovery.summary or ""
        facts = discovery.facts if isinstance(discovery.facts, dict) else {}
        
        if source == "neows" or discovery.type == "neo":
            is_haz = facts.get("Potentially Hazardous") == "Yes" or facts.get("is_potentially_hazardous") is True
            dist = facts.get("Closest Approach Distance") or facts.get("miss_distance_km")
            size = facts.get("Estimated Diameter")
            
            details = []
            if is_haz:
                details.append("Classified by NASA as a Potentially Hazardous Asteroid (PHA)")
            else:
                details.append("A notable cosmic close approach")
                
            if size:
                details.append(f"with size {size}")
            if dist:
                details.append(f"passing within {dist} of Earth")
                
            discovery.why_interesting = ", ".join(details) + "."
            
        elif source == "donki" or discovery.type == "solar_flare":
            flare_cls = str(facts.get("Flare Classification") or facts.get("class") or "").strip().upper()
            active_reg = facts.get("Active Region") or facts.get("active_region")
            
            if flare_cls.startswith("X"):
                text = "Classified as an X-class flare—the most intense solar eruption class, capable of causing widespread radio blackouts."
            elif flare_cls.startswith("M"):
                text = "Classified as an M-class flare, causing moderate space weather effects and brief radio blackouts."
            else:
                text = "A solar flare event releasing bursts of electromagnetic radiation into interplanetary space."
                
            if active_reg and str(active_reg).lower() not in ["none detected", "none"]:
                text += f" Erupted from Solar Active Region {active_reg}."
            discovery.why_interesting = text
            
        elif source == "apod":
            date_str = str(discovery.date) if discovery.date else "featured date"
            first_sentence = summary.split(". ")[0].strip() if summary else ""
            if first_sentence and len(first_sentence) < 180:
                if not first_sentence.endswith("."):
                    first_sentence += "."
                discovery.why_interesting = f"Selected as NASA's Astronomy Picture of the Day for {date_str}. {first_sentence}"
            else:
                discovery.why_interesting = f"Selected as NASA's Astronomy Picture of the Day for {date_str}, featuring {title} with astronomical commentary."
                
        else:
            discovery.why_interesting = f"Significant astronomical observation: {title}."
            
        discovery.save(update_fields=['why_interesting'])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_rename_interactions_interaction'),
    ]

    operations = [
        migrations.RunPython(backfill_why_interesting, reverse_code=migrations.RunPython.noop),
    ]
