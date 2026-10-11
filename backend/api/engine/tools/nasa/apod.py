import re
from typing import Any
from datetime import datetime
from api.engine.contracts import BaseTool, ToolResult, ToolExecutionContext, DiscoveryData, ResultType
from api.services.nasa.nasa_services import get_astronomy_picture
from api.services.credentials import get_provider_key


def format_apod_facts(response: dict[str, Any]) -> dict[str, Any]:
    """
    Formats facts with clean, human-readable Title Case keys.
    """
    facts = {}
    if response.get("date"):
        facts["Feature Date"] = response.get("date")
    media_type = response.get("media_type")
    if media_type:
        facts["Media Type"] = str(media_type).capitalize()
    return facts


class APODTool(BaseTool):
    """
    NASA Astronomy Picture of the Day (APOD) Tool.
    Retrieves the astronomy picture for a specific date or today.
    """
    
    @property
    def name(self) -> str:
        return "apod"
        
    @property
    def description(self) -> str:
        return "Retrieve the NASA Astronomy Picture of the Day. Use this to get an image and explanation for a specific date or today's date."
        
    @property
    def parameters(self) -> list:
        return []
        
    @property
    def result_type(self) -> str:
        return ResultType.APOD.value
        
    def get_openai_schema(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "The date of the APOD image to retrieve, in YYYY-MM-DD format. If omitted, returns today's image."
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
            clean_date = date.strip()
            try:
                datetime.strptime(clean_date, "%Y-%m-%d")
            except ValueError:
                raise ValueError("The 'date' argument must be a valid date in YYYY-MM-DD format.")
            arguments["date"] = clean_date
        return arguments
        
    def execute(self, context: ToolExecutionContext, **kwargs) -> ToolResult:
        date = kwargs.get("date")
        requested_date = date
        fallback_applied = False
        
        api_key = get_provider_key(context.user_id, "nasa") if context.user_id else None
        
        response = get_astronomy_picture(date=date, api_key=api_key)

        # Classified fallback: Only trigger fallback for confirmed date-related unavailability / out-of-range dates.
        # NEVER mask authentication failures (401/403), rate limits (429), not-found (404 for past dates), 5xx server errors, or network timeouts.
        if "error" in response and date:
            error_msg = str(response.get("error", ""))
            status_code = response.get("status_code")
            error_type = response.get("error_type")
            details = str(response.get("details", ""))
            combined_err = f"{error_msg} {details}".lower()

            today_str = datetime.now().date().isoformat()
            is_future_or_out_of_range = (date > today_str) or (date < "1995-06-16")

            is_non_fallback_error = (
                status_code in [401, 403, 429] or
                (status_code == 404 and not is_future_or_out_of_range) or
                (status_code is not None and status_code >= 500) or
                error_type in ["auth_error", "rate_limit", "network_error", "server_error"] or
                (error_type == "not_found" and not is_future_or_out_of_range) or
                "rejected" in combined_err or
                "rate limit" in combined_err or
                "network error" in combined_err
            )

            if not is_non_fallback_error:
                is_date_error_msg = any(phrase in combined_err for phrase in [
                    "date must be between",
                    "does not match format",
                    "time data",
                    "out of range",
                    "future date",
                    "no picture available",
                    "apod not found",
                    "apod_basic_not_found",
                    "invalid parameter(s): date",
                ]) or (status_code in [400, 404] and bool(re.search(r"\bdate\b", combined_err)))

                if is_future_or_out_of_range or is_date_error_msg:
                    fallback_response = get_astronomy_picture(date=None, api_key=api_key)
                    if "error" not in fallback_response:
                        response = fallback_response
                        fallback_applied = True

        if "error" in response:
            return ToolResult(
                tool_name=self.name,
                result_type="error",
                data={"error": response["error"]},
                metadata={
                    "success": False,
                    "date": date,
                    "fallback_applied": False,
                    "requested_date": requested_date
                }
            )

        actual_date = response.get("date")
        explanation = response.get("explanation", "")
        if fallback_applied:
            fallback_notice = (
                f"Note: APOD for requested date '{requested_date}' was unavailable. "
                f"Showing latest available Astronomy Picture of the Day from {actual_date}."
            )
            explanation = f"{fallback_notice}\n\n{explanation}" if explanation else fallback_notice

        facts = format_apod_facts(response)
        if fallback_applied:
            facts["Requested Date"] = requested_date
            facts["Actual Date"] = actual_date
            facts["Fallback Applied"] = "Yes"

        source_url = response.get("permalink") or response.get("image_url", "")
        media_url = response.get("image_url", "")

        discovery = DiscoveryData(
            source=self.name,
            external_id=actual_date,
            title=response.get("title", "NASA APOD"),
            summary=explanation,
            why_interesting="",
            date=actual_date,
            source_url=source_url,
            facts=facts,
            media=[{
                "url": media_url,
                "media_type": response.get("media_type", "image"),
                "type": response.get("media_type", "image"),
                "is_primary": True
            }]
        )
        
        return ToolResult(
            tool_name=self.name,
            result_type=self.result_type,
            data={
                "title": response.get("title", ""),
                "date": actual_date or "",
                "explanation": explanation,
                "media_url": media_url,
                "media_type": response.get("media_type", ""),
                "permalink": response.get("permalink", ""),
                "fallback_applied": fallback_applied,
                "requested_date": requested_date
            },
            discoveries=[discovery],
            metadata={
                "success": True,
                "date": actual_date,
                "fallback_applied": fallback_applied,
                "requested_date": requested_date,
                "actual_date": actual_date
            }
        )
