from typing import Any
from api.engine.contracts import BaseTool, ToolResult, ToolExecutionContext, DiscoveryData, ResultType
from api.services.nasa.nasa_services import search_nasa_images, clean_nasa_description


def format_nasa_image_facts(item: dict[str, Any]) -> dict[str, Any]:
    """
    Formats facts with clean, human-readable Title Case keys.
    """
    facts = {}
    if item.get("center"):
        facts["NASA Center"] = item.get("center")
    if item.get("date_created"):
        facts["Date Created"] = item.get("date_created").split("T")[0]
    if item.get("nasa_id"):
        facts["NASA ID"] = item.get("nasa_id")
    keywords = item.get("keywords")
    if keywords and isinstance(keywords, list):
        facts["Keywords"] = ", ".join(str(k) for k in keywords[:4])
    return facts


class NASAImagesTool(BaseTool):
    """
    NASA Image and Video Library Search Tool.
    Searches NASA's official media archive for missions, celestial bodies, and historical events.
    """

    @property
    def name(self) -> str:
        return "nasa_images"

    @property
    def description(self) -> str:
        return (
            "Search NASA's official image and media archive for space missions (e.g. James Webb, Hubble, Apollo), "
            "celestial bodies (planets, nebulae, galaxies, black holes), and historical events."
        )

    @property
    def parameters(self) -> list:
        return []

    @property
    def result_type(self) -> str:
        return ResultType.NASA_IMAGES.value

    def get_openai_schema(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The concise search keyword or entity to query in the NASA image archive (e.g. 'Carina Nebula James Webb', 'Jupiter', 'OSIRIS-REx Bennu', 'Hubble spiral galaxy'). When looking for space imagery, always include a specific celestial target or observation term rather than bare hardware or telescope names alone (which return ground cleanroom/assembly photos). Use only the specific object or target name without conversational filler words."
                    },
                    "page": {
                        "type": "integer",
                        "description": "Optional page number to retrieve (e.g. 1, 2, 3) to fetch subsequent results if the user asks for more."
                    }
                },
                "required": ["query"],
                "additionalProperties": False
            }
        }

    def validate_arguments(self, arguments: dict[str, Any]) -> dict[str, Any]:
        if "query" not in arguments:
            raise ValueError("The 'query' argument is required.")
        query = arguments.get("query")
        if not isinstance(query, str) or not query.strip():
            raise ValueError("The 'query' argument must be a non-empty string.")
        page = arguments.get("page")
        if page is not None:
            try:
                page_int = int(page)
                if page_int < 1:
                    arguments["page"] = 1
                elif page_int > 100:
                    arguments["page"] = 100
                else:
                    arguments["page"] = page_int
            except (ValueError, TypeError):
                arguments["page"] = 1
        return arguments

    def execute(self, context: ToolExecutionContext, **kwargs) -> ToolResult:
        query = kwargs["query"].strip()
        page = kwargs.get("page", 1)

        response = search_nasa_images(query=query, page=page)

        if "error" in response:
            return ToolResult(
                tool_name=self.name,
                result_type="error",
                data={"error": response["error"]},
                metadata={"success": False, "query": query, "page": page}
            )

        items = response.get("items", [])
        total_hits = response.get("total_hits")
        actual_query = response.get("query") or query
        original_query = response.get("original_query")

        if not items:
            summary_msg = (
                f"No media archive assets found matching '{query}'."
                if page == 1
                else f"No further media archive assets found on page {page} matching '{query}'."
            )
            data_dict = {
                "title": f"NASA Media Archive: {query}",
                "summary": summary_msg,
                "query": query,
                "page": page,
                "item_count": 0,
                "items": []
            }
            if total_hits is not None:
                data_dict["total_hits"] = total_hits

            meta_dict = {"success": True, "count": 0, "query": query, "page": page}
            if total_hits is not None:
                meta_dict["total_hits"] = total_hits

            return ToolResult(
                tool_name=self.name,
                result_type=self.result_type,
                data=data_dict,
                discoveries=[],
                metadata=meta_dict
            )

        # Filter out discoveries already in the SpacePlan so follow-ups deliver fresh discoveries
        existing_external_ids = set()
        if context.space_plan_id:
            try:
                from api.models import Discovery
                existing_external_ids = set(
                    Discovery.objects.filter(space_plan_id=context.space_plan_id).values_list("external_id", flat=True)
                )
            except Exception:
                pass

        fresh_items = [it for it in items if (it.get("nasa_id") or "") not in existing_external_ids]

        # If all items on this page already exist in the plan, return an honest empty result instead of re-injecting duplicates
        if not fresh_items and existing_external_ids:
            data_dict = {
                "title": f"NASA Media Archive: {actual_query}",
                "summary": (
                    f"All {len(items)} media items from page {page} matching '{actual_query}' "
                    f"have already been added to this exploration plan. "
                    f"Try requesting the next page (page {page + 1}) or searching with a more specific term."
                ),
                "query": actual_query,
                "page": page,
                "item_count": 0,
                "items": []
            }
            if total_hits is not None:
                data_dict["total_hits"] = total_hits

            meta_dict = {
                "success": True,
                "count": len(items),
                "query": actual_query,
                "page": page,
                "returned_count": 0,
                "all_items_already_exist": True
            }
            if total_hits is not None:
                meta_dict["total_hits"] = total_hits

            return ToolResult(
                tool_name=self.name,
                result_type=self.result_type,
                data=data_dict,
                discoveries=[],
                metadata=meta_dict
            )

        selected_items = fresh_items[:6]

        discoveries = []
        for idx, item in enumerate(selected_items):
            media_list = []
            if item.get("image_url"):
                media_list.append({
                    "url": item["image_url"],
                    "media_type": "image",
                    "type": "image",
                    "is_primary": True
                })

            date_str = item.get("date_created")
            clean_date = date_str.split("T")[0] if date_str else None

            raw_summary = item.get("description") or "NASA imagery asset."
            clean_summary = clean_nasa_description(raw_summary) or "NASA imagery asset."

            discoveries.append(DiscoveryData(
                source=self.name,
                external_id=item.get("nasa_id") or None,
                title=item.get("title") or f"NASA Asset: {actual_query}",
                summary=clean_summary,
                why_interesting="",
                date=clean_date,
                source_url=item.get("image_url") or "https://images.nasa.gov",
                facts=format_nasa_image_facts(item),
                media=media_list
            ))

        summary_text = (
            f"Retrieved {len(selected_items)} media items matching '{actual_query}'."
            if not original_query
            else f"Retrieved {len(selected_items)} media items matching '{actual_query}' (refined from '{original_query}')."
        )

        data_dict = {
            "title": f"NASA Media Archive: {actual_query}",
            "summary": summary_text,
            "query": actual_query,
            "item_count": len(items),
            "items": selected_items
        }
        if total_hits is not None:
            data_dict["total_hits"] = total_hits

        meta_dict = {
            "success": True,
            "count": len(items),
            "query": actual_query,
            "original_query": original_query,
            "returned_count": len(selected_items)
        }
        if total_hits is not None:
            meta_dict["total_hits"] = total_hits

        return ToolResult(
            tool_name=self.name,
            result_type=self.result_type,
            data=data_dict,
            discoveries=discoveries,
            metadata=meta_dict
        )
