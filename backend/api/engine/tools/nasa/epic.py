from datetime import datetime
from typing import Any
from api.engine.contracts import BaseTool, ToolResult, ToolExecutionContext, DiscoveryData, ResultType
from api.services.nasa.nasa_services import get_epic_earth_imagery
from api.services.credentials import get_provider_key


def format_epic_facts(image: dict[str, Any]) -> dict[str, Any]:
    """
    Formats facts with clean, human-readable Title Case keys.
    """
    facts = {
        "Spacecraft": "NOAA DSCOVR",
        "Position": "Sun-Earth L1 Lagrange Point (1 million miles out)",
    }
    if image.get("date"):
        facts["Observation Time"] = image.get("date")

    centroid = image.get("centroid_coordinates")
    if centroid and isinstance(centroid, dict):
        lat = centroid.get("lat")
        lon = centroid.get("lon")
        if lat is not None and lon is not None:
            facts["Center Latitude"] = f"{float(lat):.2f}°"
            facts["Center Longitude"] = f"{float(lon):.2f}°"

    return facts


class EPICTool(BaseTool):
    """
    NASA Earth Polychromatic Imaging Camera (EPIC) Tool.
    Retrieves full-disc imagery of Earth taken by NOAA's DSCOVR satellite at Lagrange Point 1.
    """

    @property
    def name(self) -> str:
        return "epic"

    @property
    def description(self) -> str:
        return (
            "Retrieve full-disc imagery of Earth taken by NASA's EPIC camera aboard the DSCOVR spacecraft "
            "positioned at the Sun-Earth L1 Lagrange point (one million miles from Earth). "
            "Supports an optional observation date in YYYY-MM-DD format."
        )

    @property
    def parameters(self) -> list:
        return []

    @property
    def result_type(self) -> str:
        return ResultType.EPIC.value

    def get_openai_schema(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "The observation date in YYYY-MM-DD format. If omitted, returns the most recent available Earth imagery."
                    }
                },
                "additionalProperties": False
            }
        }

    def validate_arguments(self, arguments: dict[str, Any]) -> dict[str, Any]:
        date = arguments.get("date")
        if date is not None:
            if not isinstance(date, str):
                raise ValueError("The 'date' argument must be a string in YYYY-MM-DD format.")
            try:
                datetime.strptime(date.strip(), "%Y-%m-%d")
            except ValueError:
                raise ValueError("The 'date' argument must be a valid date in YYYY-MM-DD format.")
            arguments["date"] = date.strip()
        return arguments

    def execute(self, context: ToolExecutionContext, **kwargs) -> ToolResult:
        date = kwargs.get("date")
        api_key = get_provider_key(context.user_id, "nasa") if context.user_id else None

        response = get_epic_earth_imagery(date=date, api_key=api_key)

        if "error" in response:
            return ToolResult(
                tool_name=self.name,
                result_type="error",
                data={"error": response["error"]},
                metadata={"success": False, "date": date}
            )

        images = response.get("images", [])
        obs_date = response.get("date") or date or "Recent"

        # Graceful fallback: If a requested date returned no imagery (e.g. future date or telemetry gap), fetch latest available imagery
        if not images and date:
            fallback_response = get_epic_earth_imagery(date=None, api_key=api_key)
            if "error" not in fallback_response and fallback_response.get("images"):
                response = fallback_response
                images = response.get("images", [])
                obs_date = response.get("date") or "Recent"

        if not images:
            return ToolResult(
                tool_name=self.name,
                result_type=self.result_type,
                data={
                    "title": f"Earth from DSCOVR EPIC ({obs_date})",
                    "summary": (
                        f"No DSCOVR EPIC Earth imagery was captured or cataloged for {obs_date}. "
                        "Note that DSCOVR regular observations began in mid-2015, and occasional spacecraft calibration "
                        "or telemetry gaps occur."
                    ),
                    "date": date or "",
                    "image_count": 0,
                    "images": []
                },
                discoveries=[],
                metadata={"success": True, "count": 0, "date": date}
            )

        discoveries = []
        for idx, img in enumerate(images[:3]):
            media_list = []
            if img.get("image_url"):
                media_list.append({
                    "url": img["image_url"],
                    "media_type": "image",
                    "type": "image",
                    "is_primary": True
                })

            item_date = img.get("date", "").split()[0] if img.get("date") else obs_date

            discoveries.append(DiscoveryData(
                source=self.name,
                external_id=img.get("identifier") or f"epic_{obs_date}_{idx}",
                title=f"Earth from Deep Space ({item_date})",
                summary=(
                    img.get("caption")
                    or f"Full-disc imagery of Earth captured by EPIC on the DSCOVR spacecraft from Lagrange Point 1."
                ),
                why_interesting="",
                date=item_date,
                source_url=img.get("image_url") or "https://epic.gsfc.nasa.gov",
                facts=format_epic_facts(img),
                media=media_list
            ))

        return ToolResult(
            tool_name=self.name,
            result_type=self.result_type,
            data={
                "title": f"Earth from DSCOVR EPIC ({obs_date})",
                "summary": f"Retrieved {len(images)} full-disc Earth observations from DSCOVR at Lagrange Point 1 for {obs_date}.",
                "date": obs_date,
                "image_count": len(images),
                "images": images[:3]
            },
            discoveries=discoveries,
            metadata={"success": True, "count": len(images), "date": obs_date}
        )
