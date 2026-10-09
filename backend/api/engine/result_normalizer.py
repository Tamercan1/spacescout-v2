from typing import Any
from api.engine.contracts import OrchestratorResult, ResultType

class ResultNormalizer:
    @staticmethod
    def normalize(orchestrator_result: OrchestratorResult) -> dict[str, Any]:
        """
        Produces the JSON-serializable dict that will be saved in Interaction.response.
        """
        if not orchestrator_result.success:
            return {
                "error": orchestrator_result.error_message,
                "error_code": orchestrator_result.error_code
            }

        success_results = [tr for tr in orchestrator_result.tool_results if tr.result_type != "error"]
        error_results = [tr for tr in orchestrator_result.tool_results if tr.result_type == "error"]
        
        failures = [{"tool": tr.tool_name, "error": tr.data.get("error")} for tr in error_results]
        llm_content = orchestrator_result.llm_content
        
        # If no tools were successfully called, it's just an analysis
        if len(success_results) == 0:
            return {
                "result_type": ResultType.ANALYSIS.value,
                "content": {
                    "title": "Analysis",
                    "summary": "AI Response",
                    "sections": [{"heading": "Response", "content": llm_content}] if llm_content else []
                },
                "discoveries": [],
                "metadata": {"tool_failures": failures} if failures else {}
            }
        
        # If EXACTLY ONE tool was successfully called, use that tool's result type and data.
        if len(success_results) == 1:
            tr = success_results[0]
            metadata = dict(tr.metadata)
            if llm_content:
                metadata["synthesis"] = llm_content
            if failures:
                metadata["tool_failures"] = failures
                
            return {
                "result_type": tr.result_type,
                "content": tr.data,
                "discoveries": [], # will be populated by persistence
                "metadata": metadata
            }
            
        # If multiple tools were called, return ANALYSIS with a streamlined view
        if llm_content:
            sections = [{
                "heading": "Response",
                "content": llm_content
            }]
            title = "Analysis"
        else:
            sections = []
            for tr in success_results:
                title_item = tr.data.get("title", f"{tr.tool_name} Result")
                content = tr.data.get("summary", "") or tr.data.get("explanation", "") or "No details provided."
                sections.append({
                    "heading": str(title_item),
                    "content": str(content)
                })
            title = "Analysis"
            
        return {
            "result_type": ResultType.ANALYSIS.value,
            "content": {
                "title": title,
                "summary": "AI Response" if llm_content else "Results from multiple tools",
                "sections": sections
            },
            "discoveries": [],
            "metadata": {
                "tool_count": len(success_results),
                "tool_failures": failures
            } if failures else {"tool_count": len(success_results)}
        }
