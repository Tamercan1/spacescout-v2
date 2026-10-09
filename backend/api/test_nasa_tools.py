from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from api.models import SpacePlan, Discovery
from api.serializers import DiscoverySerializer
from api.engine.tools.nasa.apod import APODTool
from api.engine.tools.nasa.neows import NeoWsTool
from api.engine.tools.nasa.donki import DonkiTool
from api.engine.tool_registry_v2 import registry
from api.engine.contracts import ToolExecutionContext, ResultType, OrchestratorResult
from api.engine.result_normalizer import ResultNormalizer
from api.services.nasa.nasa_services import get_solar_flares

User = get_user_model()

class TestNASATools(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="test_nasa_user")
        self.context = ToolExecutionContext(
            space_plan_id=1,
            user_id=self.user.id
        )

    @patch("api.engine.tools.nasa.apod.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.apod.get_astronomy_picture")
    def test_apod_tool_success(self, mock_get, mock_get_provider_key):
        mock_get.return_value = {
            "date": "2023-10-01",
            "title": "A Star",
            "explanation": "A big star.",
            "image_url": "http://nasa.gov/star.jpg",
            "media_type": "image",
            "source": "NASA"
        }
        
        tool = APODTool()
        result = tool.execute(self.context, date="2023-10-01")
        
        mock_get.assert_called_once_with(date="2023-10-01", api_key="mock_nasa_key")
        
        self.assertEqual(result.tool_name, "apod")
        self.assertEqual(result.result_type, ResultType.APOD.value)
        self.assertTrue(result.metadata.get("success"))
        self.assertEqual(len(result.discoveries), 1)
        
        discovery = result.discoveries[0]
        self.assertEqual(discovery.source, "apod")
        self.assertEqual(discovery.external_id, "2023-10-01")
        self.assertEqual(discovery.title, "A Star")
        self.assertEqual(discovery.summary, "A big star.")
        self.assertEqual(discovery.date, "2023-10-01")
        self.assertEqual(discovery.source_url, "http://nasa.gov/star.jpg")
        self.assertEqual(discovery.why_interesting, "")
        self.assertEqual(discovery.facts["Feature Date"], "2023-10-01")
        self.assertNotIn("mock_nasa_key", discovery.title)

    @patch("api.engine.tools.nasa.apod.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.apod.get_astronomy_picture")
    def test_apod_tool_failure(self, mock_get, mock_get_provider_key):
        mock_get.return_value = {"error": "NASA API key was rejected. Check NASA_API_KEY."}
        
        tool = APODTool()
        result = tool.execute(self.context, date="2023-10-01")
        
        self.assertFalse(result.metadata.get("success"))
        self.assertEqual(result.data["error"], "NASA API key was rejected. Check NASA_API_KEY.")
        self.assertEqual(len(result.discoveries), 0)

    @patch("api.engine.tools.nasa.neows.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.neows.search_near_earth_objects")
    def test_neows_tool_success(self, mock_search, mock_get_provider_key):
        mock_search.return_value = {
            "count": 2,
            "objects": [
                {
                    "id": "123",
                    "name": "Asteroid 123",
                    "date": "2023-10-01",
                    "estimated_diameter_km": {"min": 1.0, "max": 2.0},
                    "miss_distance_km": "5000000",
                    "is_potentially_hazardous": True,
                    "nasa_jpl_url": "http://nasa.gov/123"
                },
                {
                    "id": "456",
                    "name": "Asteroid 456",
                    "date": "2023-10-02",
                    "estimated_diameter_km": {"min": 0.5, "max": 1.0},
                    "miss_distance_km": "10000000",
                    "is_potentially_hazardous": False,
                    "nasa_jpl_url": "http://nasa.gov/456"
                }
            ]
        }
        
        tool = NeoWsTool()
        result = tool.execute(self.context, start_date="2023-10-01", end_date="2023-10-05")
        
        mock_search.assert_called_once_with(
            start_date="2023-10-01",
            end_date="2023-10-05",
            api_key="mock_nasa_key"
        )
        
        self.assertEqual(len(result.discoveries), 2)
        
        d1 = result.discoveries[0]
        self.assertEqual(d1.source, "neows")
        self.assertEqual(d1.external_id, "123")
        self.assertEqual(d1.title, "Asteroid Asteroid 123")
        self.assertEqual(d1.facts["Potentially Hazardous"], "Yes")
        self.assertEqual(d1.why_interesting, "")
        self.assertEqual(d1.source_url, "http://nasa.gov/123")

        d2 = result.discoveries[1]
        self.assertEqual(d2.facts["Potentially Hazardous"], "No")
        self.assertEqual(d2.why_interesting, "")

    def test_neows_tool_validation(self):
        tool = NeoWsTool()
        with self.assertRaises(ValueError):
            tool.validate_arguments({"start_date": "2023-10-01"}) # missing end_date

    @patch("api.engine.tools.nasa.donki.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.donki.get_solar_flares")
    def test_donki_tool_success(self, mock_get_flares, mock_get_provider_key):
        mock_get_flares.return_value = {
            "count": 1,
            "flares": [
                {
                    "id": "FLR-1",
                    "start_time": "2023-10-01T12:00Z",
                    "peak_time": "2023-10-01T12:30Z",
                    "end_time": "2023-10-01T13:00Z",
                    "class": "X1.2",
                    "source_location": "N10E20",
                    "active_region": "12345",
                    "note": "A big flare.",
                    "url": "http://nasa.gov/flr-1"
                }
            ]
        }
        
        tool = DonkiTool()
        result = tool.execute(self.context, start_date="2023-10-01", end_date="2023-10-05")
        
        self.assertEqual(len(result.discoveries), 1)
        d = result.discoveries[0]
        self.assertEqual(d.source, "donki")
        self.assertEqual(d.external_id, "FLR-1")
        self.assertEqual(d.title, "Solar Flare: Class X1.2")
        self.assertEqual(d.date, "2023-10-01")
        self.assertEqual(d.facts["Flare Classification"], "X1.2")
        self.assertEqual(d.why_interesting, "")

    def test_registry_integration(self):
        # Tools should be available in V2 registry
        self.assertTrue(registry.has("apod"))
        self.assertTrue(registry.has("neows"))
        self.assertTrue(registry.has("donki"))
        
        schemas = registry.get_openai_schemas()
        names = [s["function"]["name"] for s in schemas]
        self.assertIn("apod", names)
        self.assertIn("neows", names)
        self.assertIn("donki", names)

    def test_nasa_flr_endpoint_configuration(self):
        from api.services.nasa.nasa_services import NASA_FLR_URL
        self.assertEqual(NASA_FLR_URL, "https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR")

    @patch("api.services.nasa.nasa_services.get")
    def test_get_solar_flares_query_parameters(self, mock_get):
        from api.services.nasa.nasa_services import get_solar_flares, NASA_FLR_URL
        mock_get.return_value = ([], None)
        get_solar_flares("2026-10-01", "2026-10-05", api_key="test_key")
        mock_get.assert_called_once_with(
            NASA_FLR_URL,
            {
                "startDate": "2026-10-01",
                "endDate": "2026-10-05",
                "api_key": "test_key",
            }
        )

    @patch("api.services.nasa.nasa_services.httpx.get")
    def test_get_handles_redirect_to_unexpected_page(self, mock_http_get):
        from api.services.nasa.nasa_services import get
        mock_resp = MagicMock()
        mock_resp.headers = {"content-type": "text/html; charset=utf-8"}
        mock_resp.text = "<html><body>Major Updates</body></html>"
        mock_resp.url = "https://ccmc.gsfc.nasa.gov/news/major-updates"
        mock_resp.raise_for_status.return_value = None
        mock_http_get.return_value = mock_resp

        data, error = get("https://api.nasa.gov/DONKI/FLR", params={})
        self.assertIsNone(data)
        self.assertIn("redirected unexpectedly", error)
        self.assertIn("https://ccmc.gsfc.nasa.gov/news/major-updates", error)

    @patch("api.engine.tools.nasa.donki.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.donki.get_solar_flares")
    def test_donki_tool_handles_service_error_gracefully(self, mock_get_flares, mock_get_provider_key):
        mock_get_flares.return_value = {"error": "NASA API endpoint redirected unexpectedly to https://ccmc.gsfc.nasa.gov/news/major-updates"}
        tool = DonkiTool()
        result = tool.execute(self.context, start_date="2026-10-01", end_date="2026-10-05")
        self.assertEqual(result.result_type, "error")
        self.assertFalse(result.metadata["success"])
        self.assertIn("redirected unexpectedly", result.data["error"])
        self.assertEqual(len(result.discoveries), 0)

    @patch("api.services.nasa.nasa_services.get")
    def test_successful_flr_normalization_and_discovery_card_output(self, mock_nasa_get):
        mock_raw_data = [
            {
                "flrID": "2026-10-09T14:00:00-FLR-001",
                "instruments": [{"displayName": "GOES-16"}],
                "beginTime": "2026-10-09T14:00Z",
                "peakTime": "2026-10-09T14:25Z",
                "endTime": "2026-10-09T14:50Z",
                "classType": "X2.5",
                "sourceLocation": "S15W30",
                "activeRegionNum": 13850,
                "link": "https://ccmc.gsfc.nasa.gov/donki/FLR/2026-10-09T14:00:00-FLR-001",
                "note": "Major solar flare eruption detected by space weather monitoring."
            },
            {
                "flrID": "2026-10-09T08:00:00-FLR-002",
                "instruments": [{"displayName": "GOES-18"}],
                "beginTime": "2026-10-09T08:00Z",
                "peakTime": "2026-10-09T08:15Z",
                "endTime": "2026-10-09T08:30Z",
                "classType": "M1.0",
                "sourceLocation": "N05E10",
                "activeRegionNum": None,
                "link": "https://ccmc.gsfc.nasa.gov/donki/FLR/2026-10-09T08:00:00-FLR-002",
                "note": ""
            }
        ]
        mock_nasa_get.return_value = (mock_raw_data, None)

        # 1. Normalization in get_solar_flares
        parsed = get_solar_flares("2026-10-01", "2026-10-09")
        self.assertEqual(parsed["count"], 2)
        self.assertEqual(len(parsed["flares"]), 2)
        flare1 = parsed["flares"][0]
        self.assertEqual(flare1["id"], "2026-10-09T14:00:00-FLR-001")
        self.assertEqual(flare1["class"], "X2.5")
        self.assertEqual(flare1["active_region"], 13850)

        # 2. Normalization to ToolResult and DiscoveryData in DonkiTool
        tool = DonkiTool()
        tool_result = tool.execute(self.context, start_date="2026-10-01", end_date="2026-10-09")

        self.assertEqual(tool_result.tool_name, "donki")
        self.assertEqual(tool_result.result_type, ResultType.DONKI.value)
        self.assertTrue(tool_result.metadata.get("success"))
        self.assertEqual(len(tool_result.discoveries), 2)

        d1 = tool_result.discoveries[0]
        self.assertEqual(d1.source, "donki")
        self.assertEqual(d1.external_id, "2026-10-09T14:00:00-FLR-001")
        self.assertEqual(d1.title, "Solar Flare: Class X2.5")
        self.assertEqual(d1.date, "2026-10-09")
        self.assertEqual(d1.why_interesting, "")
        self.assertEqual(d1.facts["Flare Classification"], "X2.5")
        self.assertEqual(d1.facts["Peak Time"], "2026-10-09T14:25Z")
        self.assertEqual(d1.facts["Active Region"], "13850")
        self.assertEqual(d1.facts["Source Location"], "S15W30")

        d2 = tool_result.discoveries[1]
        self.assertEqual(d2.title, "Solar Flare: Class M1.0")
        self.assertEqual(d2.why_interesting, "")
        self.assertEqual(d2.facts["Active Region"], "None detected")

        # 3. Normalization through ResultNormalizer
        orch_result = OrchestratorResult(
            success=True,
            tool_results=[tool_result],
            discoveries=tool_result.discoveries,
            llm_content="Solar flare report complete."
        )
        normalized = ResultNormalizer.normalize(orch_result)
        self.assertEqual(normalized["result_type"], "donki")
        self.assertEqual(normalized["content"]["count"], 2)
        self.assertEqual(normalized["metadata"]["synthesis"], "Solar flare report complete.")

        # 4. Discovery Card serialization via DiscoverySerializer
        plan = SpacePlan.objects.create(user=self.user, title="Flare Exploration", prompt="Check flares")
        db_discovery = Discovery.objects.create(
            space_plan=plan,
            source=d1.source,
            external_id=d1.external_id,
            type=d1.source,
            title=d1.title,
            summary=d1.summary,
            why_interesting="A potent coronal mass ejection risk from Active Region 13850.",
            date=d1.date,
            source_url=d1.source_url,
            facts=d1.facts,
            sort_order=0
        )
        card_data = DiscoverySerializer(db_discovery).data
        self.assertEqual(card_data["source"], "donki")
        self.assertEqual(card_data["type"], "donki")
        self.assertEqual(card_data["external_id"], "2026-10-09T14:00:00-FLR-001")
        self.assertEqual(card_data["title"], "Solar Flare: Class X2.5")
        self.assertEqual(card_data["date"], "2026-10-09")
        self.assertEqual(card_data["why_interesting"], "A potent coronal mass ejection risk from Active Region 13850.")
        self.assertEqual(card_data["facts"], d1.facts)
        self.assertEqual(card_data["source_url"], "https://ccmc.gsfc.nasa.gov/donki/FLR/2026-10-09T14:00:00-FLR-001")

