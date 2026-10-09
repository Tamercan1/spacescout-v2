from typing import Any
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
        # Date is optional, but if provided it should be a string (format validation could be added if necessary)
        date = arguments.get("date")
        if date is not None and not isinstance(date, str):
            raise ValueError("The 'date' argument must be a string in YYYY-MM-DD format.")
        return arguments
        
    def execute(self, context: ToolExecutionContext, **kwargs) -> ToolResult:
        date = kwargs.get("date")
        
        api_key = get_provider_key(context.user_id, "nasa") if context.user_id else None
        
        response = get_astronomy_picture(date=date, api_key=api_key)

        # Graceful fallback: If a requested date fails (e.g. status 400 future date error), fetch the latest available picture
        if "error" in response and date:
            fallback_response = get_astronomy_picture(date=None, api_key=api_key)
            if "error" not in fallback_response:
                response = fallback_response

        if "error" in response:
            return ToolResult(
                tool_name=self.name,
                result_type="error",
                data={"error": response["error"]},
                metadata={"success": False}
            )
            
        discovery = DiscoveryData(
            source=self.name,
            external_id=response.get("date"),
            title=response.get("title", "NASA APOD"),
            summary=response.get("explanation", ""),
            why_interesting="",
            date=response.get("date"),
            source_url=response.get("image_url", ""),
            facts=format_apod_facts(response),
            media=[{
                "url": response.get("image_url", ""),
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
                "date": response.get("date", ""),
                "explanation": response.get("explanation", ""),
                "media_url": response.get("image_url", ""),
                "media_type": response.get("media_type", "")
            },
            discoveries=[discovery],
            metadata={"success": True}
        )
