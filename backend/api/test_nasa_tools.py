import unittest
from unittest.mock import patch, MagicMock
from api.engine.tools.nasa.apod import APODTool
from api.engine.tools.nasa.neows import NeoWsTool
from api.engine.tools.nasa.donki import DonkiTool
from api.engine.tool_registry_v2 import registry
from api.engine.contracts import ToolExecutionContext, ResultType

class TestNASATools(unittest.TestCase):
    def setUp(self):
        self.context = ToolExecutionContext(
            space_plan_id=1,
            user_id=1
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
        self.assertEqual(d1.facts["is_potentially_hazardous"], True)
        self.assertEqual(d1.source_url, "http://nasa.gov/123")

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
        self.assertEqual(d.facts["class"], "X1.2")

    def test_registry_integration(self):
        # Tools should be available in V2 registry
        self.assertTrue(registry.has("apod"))
        self.assertTrue(registry.has("neows"))
        self.assertTrue(registry.has("donki"))
        
        schemas = registry.get_openai_schemas()
        names = [s["name"] for s in schemas]
        self.assertIn("apod", names)
        self.assertIn("neows", names)
        self.assertIn("donki", names)
