from typing import Any
from api.engine.contracts import BaseTool, ToolResult, ToolExecutionContext, DiscoveryData, ResultType
from api.services.nasa.nasa_services import get_solar_flares
from api.services.credentials import get_provider_key

class DonkiTool(BaseTool):
    """
    NASA Space Weather Database Of Notifications, Knowledge, Information (DONKI) Tool.
    Retrieves solar flares within a date range.
    """
    
    @property
    def name(self) -> str:
        return "donki"
        
    @property
    def description(self) -> str:
        return "Retrieve solar flare events using NASA's DONKI. Provides information on space weather events within a specified date range."
        
    @property
    def parameters(self) -> list:
        return []
        
    @property
    def result_type(self) -> str:
        return ResultType.DONKI.value
        
    def get_openai_schema(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "The start date for the search in YYYY-MM-DD format (default is 30 days prior to current UTC date)."
                    },
                    "end_date": {
                        "type": "string",
                        "description": "The end date for the search in YYYY-MM-DD format (default is current UTC date)."
                    }
                },
                "required": ["start_date", "end_date"],
                "additionalProperties": False
            }
        }
        
    def validate_arguments(self, arguments: dict[str, Any]) -> dict[str, Any]:
        if "start_date" not in arguments:
            raise ValueError("The 'start_date' argument is required.")
        if "end_date" not in arguments:
            raise ValueError("The 'end_date' argument is required.")
            
        start_date = arguments["start_date"]
        end_date = arguments["end_date"]
        
        if not isinstance(start_date, str) or not isinstance(end_date, str):
            raise ValueError("Dates must be strings in YYYY-MM-DD format.")
            
        return arguments
        
    def execute(self, context: ToolExecutionContext, **kwargs) -> ToolResult:
        start_date = kwargs["start_date"]
        end_date = kwargs["end_date"]
        
        api_key = get_provider_key(context.user_id, "nasa") if context.user_id else None
        
        # NASA API call
        response = get_solar_flares(
            start_date=start_date, 
            end_date=end_date, 
            api_key=api_key
        )
        
        if "error" in response:
            return ToolResult(
                tool_name=self.name,
                result_type=self.result_type,
                data={"error": response["error"]},
                metadata={"success": False, "start_date": start_date, "end_date": end_date}
            )
            
        discoveries = []
        flares = response.get("flares", [])
        
        for flare in flares:
            # Try to extract the date from the start_time (which usually comes back as e.g. "2023-10-01T12:00Z")
            date_str = flare.get("start_time", "").split("T")[0] if flare.get("start_time") else None
            
            discovery = DiscoveryData(
                source=self.name,
                external_id=flare.get("id"),
                title=f"Solar Flare: Class {flare.get('class')}",
                summary=flare.get("note", f"A {flare.get('class')} class solar flare event."),
                date=date_str,
                source_url=flare.get("url", ""),
                facts={
                    "class": flare.get("class"),
                    "start_time": flare.get("start_time"),
                    "peak_time": flare.get("peak_time"),
                    "end_time": flare.get("end_time"),
                    "active_region": flare.get("active_region"),
                    "source_location": flare.get("source_location")
                }
            )
            discoveries.append(discovery)
            
        return ToolResult(
            tool_name=self.name,
            result_type=self.result_type,
            data=response,
            discoveries=discoveries,
            metadata={
                "success": True, 
                "count": response.get("count", 0),
                "start_date": start_date,
                "end_date": end_date
            }
        )
