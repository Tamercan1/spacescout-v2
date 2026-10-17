from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from api.models import SpacePlan, Discovery
from api.serializers import DiscoverySerializer
from api.engine.tools.nasa.apod import APODTool
from api.engine.tools.nasa.neows import NeoWsTool
from api.engine.tools.nasa.donki import DonkiTool
from api.engine.tools.nasa.nasa_images import NASAImagesTool
from api.engine.tools.nasa.epic import EPICTool
from api.engine.tool_registry_v2 import registry
from api.engine.contracts import ToolExecutionContext, ResultType, OrchestratorResult, ToolResult
from api.engine.result_normalizer import ResultNormalizer
from api.services.result_persistence import ResultPersistenceService
from api.services.nasa.nasa_services import get_solar_flares
from api.models import Interaction

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
        self.assertEqual(len(discovery.media), 1)
        self.assertEqual(discovery.media[0]["media_type"], "image")
        self.assertTrue(discovery.media[0]["is_primary"])

    @patch("api.engine.tools.nasa.apod.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.apod.get_astronomy_picture")
    def test_apod_tool_video_success(self, mock_get, mock_get_provider_key):
        mock_get.return_value = {
            "date": "2023-10-02",
            "title": "A Cosmic Video",
            "explanation": "A video of space.",
            "image_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
            "media_type": "video",
            "source": "NASA"
        }
        tool = APODTool()
        result = tool.execute(self.context, date="2023-10-02")
        self.assertTrue(result.metadata.get("success"))
        discovery = result.discoveries[0]
        self.assertEqual(discovery.media[0]["media_type"], "video")
        self.assertTrue(discovery.media[0]["is_primary"])

    @patch("api.engine.tools.nasa.apod.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.apod.get_astronomy_picture")
    def test_apod_tool_failure(self, mock_get, mock_get_provider_key):
        mock_get.return_value = {"error": "NASA API key was rejected. Check NASA_API_KEY.", "status_code": 401, "error_type": "auth_error"}
        
        tool = APODTool()
        result = tool.execute(self.context, date="2023-10-01")
        
        # Verify fallback was NOT called on auth failure
        mock_get.assert_called_once_with(date="2023-10-01", api_key="mock_nasa_key")
        self.assertFalse(result.metadata.get("success"))
        self.assertEqual(result.data["error"], "NASA API key was rejected. Check NASA_API_KEY.")
        self.assertEqual(len(result.discoveries), 0)
        self.assertFalse(result.metadata["fallback_applied"])

    def test_apod_tool_date_validation(self):
        tool = APODTool()
        with self.assertRaises(ValueError):
            tool.validate_arguments({"date": "invalid-date"})

        with self.assertRaises(ValueError):
            tool.validate_arguments({"date": "2026/10/01"})

        validated = tool.validate_arguments({"date": "2026-10-01"})
        self.assertEqual(validated["date"], "2026-10-01")

    @patch("api.engine.tools.nasa.apod.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.apod.get_astronomy_picture")
    def test_apod_tool_fallback_on_future_date(self, mock_get, mock_get_provider_key):
        # First call with future date fails with status 400; second fallback call with date=None succeeds
        mock_get.side_effect = [
            {"error": "NASA API returned an error (status 400).", "status_code": 400, "error_type": "bad_request"},
            {
                "date": "2026-10-09",
                "title": "Latest Galaxy",
                "explanation": "A spiral galaxy observed recently.",
                "image_url": "http://nasa.gov/latest.jpg",
                "media_type": "image",
                "source": "NASA"
            }
        ]

        tool = APODTool()
        result = tool.execute(self.context, date="2099-01-01")

        self.assertEqual(mock_get.call_count, 2)
        mock_get.assert_any_call(date="2099-01-01", api_key="mock_nasa_key")
        mock_get.assert_any_call(date=None, api_key="mock_nasa_key")

        self.assertTrue(result.metadata["success"])
        self.assertTrue(result.metadata["fallback_applied"])
        self.assertEqual(result.metadata["requested_date"], "2099-01-01")
        self.assertEqual(result.metadata["actual_date"], "2026-10-09")
        self.assertTrue(result.data["fallback_applied"])
        self.assertIn("Note: APOD for requested date '2099-01-01' was unavailable", result.data["explanation"])

        self.assertEqual(len(result.discoveries), 1)
        discovery = result.discoveries[0]
        self.assertEqual(discovery.date, "2026-10-09")
        self.assertEqual(discovery.external_id, "2026-10-09")
        self.assertEqual(discovery.facts["Fallback Applied"], "Yes")
        self.assertEqual(discovery.facts["Requested Date"], "2099-01-01")
        self.assertEqual(discovery.facts["Actual Date"], "2026-10-09")

    @patch("api.engine.tools.nasa.apod.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.apod.get_astronomy_picture")
    def test_apod_tool_fallback_on_confirmed_date_400(self, mock_get, mock_get_provider_key):
        # Confirmed date-related 400 returns date-specific error message
        mock_get.side_effect = [
            {
                "error": "NASA API returned an error (status 400): Date must be between Jun 16, 1995 and Oct 10, 2026.",
                "status_code": 400,
                "error_type": "bad_request",
                "details": "Date must be between Jun 16, 1995 and Oct 10, 2026."
            },
            {
                "date": "2026-10-09",
                "title": "Latest APOD",
                "explanation": "Latest picture.",
                "image_url": "http://nasa.gov/latest.jpg",
                "media_type": "image",
                "source": "NASA"
            }
        ]
        tool = APODTool()
        result = tool.execute(self.context, date="2023-10-01")

        self.assertEqual(mock_get.call_count, 2)
        self.assertTrue(result.metadata["success"])
        self.assertTrue(result.metadata["fallback_applied"])
        self.assertEqual(result.metadata["actual_date"], "2026-10-09")

    @patch("api.engine.tools.nasa.apod.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.apod.get_astronomy_picture")
    def test_apod_tool_no_fallback_on_unrelated_400(self, mock_get, mock_get_provider_key):
        # Unrelated 400 (e.g. invalid query parameter, concept_tags syntax error)
        mock_get.return_value = {
            "error": "NASA API returned an error (status 400): Invalid parameter 'concept_tags'.",
            "status_code": 400,
            "error_type": "bad_request",
            "details": "Invalid parameter 'concept_tags'."
        }
        tool = APODTool()
        result = tool.execute(self.context, date="2023-10-01")

        mock_get.assert_called_once_with(date="2023-10-01", api_key="mock_nasa_key")
        self.assertFalse(result.metadata["success"])
        self.assertFalse(result.metadata["fallback_applied"])
        self.assertEqual(result.result_type, "error")

    @patch("api.engine.tools.nasa.apod.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.apod.get_astronomy_picture")
    def test_apod_tool_no_fallback_on_400_containing_validate(self, mock_get, mock_get_provider_key):
        # HTTP 400 details contain 'validate' (substring 'date' in 'validate') for unrelated parameter
        mock_get.return_value = {
            "error": "NASA API returned an error (status 400): Failed to validate parameter 'hd'.",
            "status_code": 400,
            "error_type": "bad_request",
            "details": "Failed to validate parameter 'hd'."
        }
        tool = APODTool()
        result = tool.execute(self.context, date="2023-10-01")

        mock_get.assert_called_once_with(date="2023-10-01", api_key="mock_nasa_key")
        self.assertFalse(result.metadata["success"])
        self.assertFalse(result.metadata["fallback_applied"])
        self.assertEqual(result.result_type, "error")

    @patch("api.engine.tools.nasa.apod.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.apod.get_astronomy_picture")
    def test_apod_tool_no_fallback_on_server_errors_500_503(self, mock_get, mock_get_provider_key):
        for status_code in [500, 503]:
            mock_get.reset_mock()
            mock_get.return_value = {
                "error": f"NASA API returned an error (status {status_code}).",
                "status_code": status_code,
                "error_type": "server_error"
            }
            tool = APODTool()
            result = tool.execute(self.context, date="2023-10-01")

            mock_get.assert_called_once_with(date="2023-10-01", api_key="mock_nasa_key")
            self.assertFalse(result.metadata["success"])
            self.assertFalse(result.metadata["fallback_applied"])
            self.assertEqual(result.result_type, "error")

    @patch("api.engine.tools.nasa.apod.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.apod.get_astronomy_picture")
    def test_apod_tool_no_fallback_on_not_found_404(self, mock_get, mock_get_provider_key):
        mock_get.return_value = {
            "error": "NASA API returned an error (status 404).",
            "status_code": 404,
            "error_type": "not_found"
        }
        tool = APODTool()
        result = tool.execute(self.context, date="2023-10-01")

        mock_get.assert_called_once_with(date="2023-10-01", api_key="mock_nasa_key")
        self.assertFalse(result.metadata["success"])
        self.assertFalse(result.metadata["fallback_applied"])
        self.assertEqual(result.result_type, "error")

    @patch("api.engine.tools.nasa.apod.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.apod.get_astronomy_picture")
    def test_apod_tool_no_fallback_on_rate_limit(self, mock_get, mock_get_provider_key):
        mock_get.return_value = {"error": "NASA API rate limit reached. Try again later.", "status_code": 429, "error_type": "rate_limit"}

        tool = APODTool()
        result = tool.execute(self.context, date="2023-10-01")

        mock_get.assert_called_once_with(date="2023-10-01", api_key="mock_nasa_key")
        self.assertFalse(result.metadata["success"])
        self.assertFalse(result.metadata["fallback_applied"])
        self.assertEqual(result.result_type, "error")

    @patch("api.engine.tools.nasa.apod.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.apod.get_astronomy_picture")
    def test_apod_tool_no_fallback_on_network_timeout(self, mock_get, mock_get_provider_key):
        mock_get.return_value = {"error": "Network Error: Could not reach the NASA API.", "error_type": "network_error"}

        tool = APODTool()
        result = tool.execute(self.context, date="2023-10-01")

        mock_get.assert_called_once_with(date="2023-10-01", api_key="mock_nasa_key")
        self.assertFalse(result.metadata["success"])
        self.assertFalse(result.metadata["fallback_applied"])
        self.assertEqual(result.result_type, "error")

    @patch("api.services.nasa.nasa_services.get")
    def test_get_astronomy_picture_latest_apod_basic(self, mock_nasa_get):
        from api.services.nasa.nasa_services import get_astronomy_picture, NASA_APOD_BASIC_URL
        mock_nasa_get.return_value = ([
            {
                "date": "2026-10-11",
                "title": "Ice Fishing for Cosmic Neutrinos",
                "explanation": "<strong>Explanation:</strong> Scientists are melting holes in the ice.",
                "hdurl": "https://assets.science.nasa.gov/image.jpg",
                "url": "https://science.nasa.gov/image-article/sample",
                "media_type": "image",
                "permalink": "https://science.nasa.gov/image-article/sample"
            }
        ], None)

        res = get_astronomy_picture()
        mock_nasa_get.assert_called_once_with(NASA_APOD_BASIC_URL, {"per_page": 1})
        self.assertEqual(res["date"], "2026-10-11")
        self.assertEqual(res["title"], "Ice Fishing for Cosmic Neutrinos")
        self.assertEqual(res["explanation"], "Scientists are melting holes in the ice.")
        self.assertEqual(res["image_url"], "https://assets.science.nasa.gov/image.jpg")
        self.assertEqual(res["media_type"], "image")
        self.assertEqual(res["permalink"], "https://science.nasa.gov/image-article/sample")

    @patch("api.services.nasa.nasa_services.get")
    def test_get_astronomy_picture_date_converts_to_yymmdd(self, mock_nasa_get):
        from api.services.nasa.nasa_services import get_astronomy_picture, NASA_APOD_BASIC_URL
        mock_nasa_get.return_value = ({
            "date": "2024-10-10",
            "title": "Five Bright Comets",
            "explanation": "Comets observed by SOHO.",
            "hdurl": "https://assets.science.nasa.gov/comet.jpg",
            "url": "https://science.nasa.gov/image-article/comet",
            "media_type": "image"
        }, None)

        res = get_astronomy_picture(date="2024-10-10")
        mock_nasa_get.assert_called_once_with(f"{NASA_APOD_BASIC_URL}/241010", {})
        self.assertEqual(res["date"], "2024-10-10")
        self.assertEqual(res["title"], "Five Bright Comets")
        self.assertEqual(res["image_url"], "https://assets.science.nasa.gov/comet.jpg")

    @patch("api.services.nasa.nasa_services.get")
    def test_get_astronomy_picture_video_extracts_iframe_embed(self, mock_nasa_get):
        from api.services.nasa.nasa_services import get_astronomy_picture
        mock_nasa_get.return_value = ({
            "date": "2021-02-23",
            "title": "Video: Perseverance Landing",
            "explanation": "<b>Explanation:</b> Watch the rover descend.",
            "media_type": "video",
            "url": "https://science.nasa.gov/image-article/video-page",
            "basic_html": '<iframe src="//www.youtube.com/embed/4czjS9h4Fpg?rel=0"></iframe>'
        }, None)

        res = get_astronomy_picture(date="2021-02-23")
        self.assertEqual(res["media_type"], "video")
        self.assertEqual(res["image_url"], "https://www.youtube.com/embed/4czjS9h4Fpg?rel=0")
        self.assertEqual(res["explanation"], "Watch the rover descend.")

    @patch("api.services.nasa.nasa_services.get")
    def test_get_astronomy_picture_video_extracts_source_tag(self, mock_nasa_get):
        from api.services.nasa.nasa_services import get_astronomy_picture
        mock_nasa_get.return_value = ({
            "date": "2026-10-16",
            "title": "Chasing the International Space Station",
            "explanation": "<b>Explanation:</b> A Falcon 9 rocket climbs into orbit.",
            "media_type": "video",
            "url": "https://science.nasa.gov/image-article/apod-2026-october-16-chasing-the-international-space-station/",
            "basic_html": '<video controls title=""><source src="https://assets.science.nasa.gov/content/dam/science/cds/apod/apod/2026/october/CRS35-Holland30s1080p.mp4" type="video/mp4"></video>'
        }, None)

        res = get_astronomy_picture(date="2026-10-16")
        self.assertEqual(res["media_type"], "video")
        self.assertEqual(res["image_url"], "https://assets.science.nasa.gov/content/dam/science/cds/apod/apod/2026/october/CRS35-Holland30s1080p.mp4")
        self.assertEqual(res["explanation"], "A Falcon 9 rocket climbs into orbit.")

    @patch("api.services.nasa.nasa_services.get")
    def test_get_astronomy_picture_fallback_to_legacy(self, mock_nasa_get):
        from api.services.nasa.nasa_services import get_astronomy_picture, NASA_APOD_BASIC_URL, NASA_APOD_LEGACY_URL, APIError
        mock_nasa_get.side_effect = [
            (None, APIError("Server Error", status_code=500, error_type="server_error")),
            ({
                "date": "2024-10-10",
                "title": "Legacy SOHO",
                "explanation": "From legacy endpoint.",
                "url": "https://legacy.nasa.gov/soho.jpg",
                "media_type": "image"
            }, None)
        ]

        res = get_astronomy_picture(date="2024-10-10", api_key="my_key")
        self.assertEqual(mock_nasa_get.call_count, 2)
        mock_nasa_get.assert_any_call(f"{NASA_APOD_BASIC_URL}/241010", {})
        mock_nasa_get.assert_any_call(NASA_APOD_LEGACY_URL, {"api_key": "my_key", "date": "2024-10-10"})
        self.assertEqual(res["title"], "Legacy SOHO")
        self.assertEqual(res["image_url"], "https://legacy.nasa.gov/soho.jpg")

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

    # ============================================================
    # NASA IMAGE AND VIDEO LIBRARY (nasa_images) TESTS
    # ============================================================

    @patch("api.engine.tools.nasa.nasa_images.search_nasa_images")
    def test_nasa_images_tool_success(self, mock_search):
        mock_search.return_value = {
            "count": 2,
            "items": [
                {
                    "nasa_id": "PIA01518",
                    "title": "Jupiter Plume",
                    "description": "Jupiter volcanic plume captured by spacecraft.",
                    "date_created": "1999-03-13T14:54:19Z",
                    "center": "JPL",
                    "keywords": ["Jupiter", "Voyager", "Volcano"],
                    "media_type": "image",
                    "image_url": "https://images-assets.nasa.gov/image/PIA01518/PIA01518~orig.jpg"
                },
                {
                    "nasa_id": "PIA01519",
                    "title": "Jupiter Rings",
                    "description": "Faint ring system around Jupiter.",
                    "date_created": "1999-03-14T10:00:00Z",
                    "center": "JPL",
                    "keywords": ["Jupiter", "Rings"],
                    "media_type": "image",
                    "image_url": "https://images-assets.nasa.gov/image/PIA01519/PIA01519~orig.jpg"
                }
            ]
        }

        tool = NASAImagesTool()
        result = tool.execute(self.context, query="Jupiter")

        mock_search.assert_called_once_with(query="Jupiter", page=1)
        self.assertEqual(result.tool_name, "nasa_images")
        self.assertEqual(result.result_type, ResultType.NASA_IMAGES.value)
        self.assertTrue(result.metadata.get("success"))
        self.assertEqual(len(result.discoveries), 2)

        d1 = result.discoveries[0]
        self.assertEqual(d1.source, "nasa_images")
        self.assertEqual(d1.external_id, "PIA01518")
        self.assertEqual(d1.title, "Jupiter Plume")
        self.assertEqual(d1.date, "1999-03-13")
        self.assertEqual(d1.facts["NASA Center"], "JPL")
        self.assertEqual(d1.facts["NASA ID"], "PIA01518")
        self.assertIn("Jupiter", d1.facts["Keywords"])
        self.assertEqual(len(d1.media), 1)
        self.assertEqual(d1.media[0]["url"], "https://images-assets.nasa.gov/image/PIA01518/PIA01518~orig.jpg")

    def test_clean_nasa_description_strips_html_boilerplate_and_shortens(self):
        from api.services.nasa.nasa_services import clean_nasa_description
        raw_text = (
            "This planetary nebula's simple appearance is thought to be due to perspective: "
            "our view looking into a cloud of gas shrugged off by a dying star. "
            "Hot blue gas gives way to progressively cooler green and red gas. "
            "Credit: NASA/Hubble Heritage Team ---- "
            "&quot;The nebula is not like a bagel, but rather like a jelly doughnut,&quot; said astronomer. "
            "Read more: <a href=\"http://1.usa.gov/14VAOMk\">link</a> "
            "<b>Follow us on <a href=\"http://twitter.com\">Twitter</a></b>"
        )
        cleaned = clean_nasa_description(raw_text)
        self.assertNotIn("<a href", cleaned)
        self.assertNotIn("<b>", cleaned)
        self.assertNotIn("&quot;", cleaned)
        self.assertNotIn("Follow us on", cleaned)
        self.assertNotIn("Read more:", cleaned)
        self.assertIn("This planetary nebula's simple appearance", cleaned)
        self.assertTrue(len(cleaned) <= 300)

    @patch("api.engine.tools.nasa.nasa_images.search_nasa_images")
    def test_nasa_images_tool_sanitizes_discovery_summary(self, mock_search):
        mock_search.return_value = {
            "count": 1,
            "items": [
                {
                    "nasa_id": "PIA99999",
                    "title": "Nebula X",
                    "description": "A glowing nebula. &quot;Amazing view,&quot; said scientists. Read more: <a href=\"#\">here</a>",
                    "date_created": "2020-01-01T00:00:00Z",
                    "center": "GSFC",
                    "keywords": ["Nebula"],
                    "media_type": "image",
                    "image_url": "https://images-assets.nasa.gov/image/PIA99999/PIA99999~orig.jpg"
                }
            ]
        }
        tool = NASAImagesTool()
        result = tool.execute(self.context, query="Nebula X")
        self.assertEqual(len(result.discoveries), 1)
        summary = result.discoveries[0].summary
        self.assertNotIn("<a href", summary)
        self.assertNotIn("&quot;", summary)
        self.assertIn("A glowing nebula.", summary)

    @patch("api.engine.tools.nasa.nasa_images.search_nasa_images")
    def test_nasa_images_tool_empty(self, mock_search):
        mock_search.return_value = {
            "count": 0,
            "items": []
        }

        tool = NASAImagesTool()
        result = tool.execute(self.context, query="UnknownCosmicTargetXYZ")

        self.assertEqual(result.result_type, ResultType.NASA_IMAGES.value)
        self.assertTrue(result.metadata.get("success"))
        self.assertEqual(result.metadata["count"], 0)
        self.assertEqual(len(result.discoveries), 0)
        self.assertIn("No media archive assets found", result.data["summary"])

    @patch("api.engine.tools.nasa.nasa_images.search_nasa_images")
    def test_nasa_images_tool_empty_page_one_messaging(self, mock_search):
        mock_search.return_value = {"count": 0, "items": []}
        tool = NASAImagesTool()
        result = tool.execute(self.context, query="NonExistentMission123", page=1)

        self.assertEqual(result.result_type, ResultType.NASA_IMAGES.value)
        self.assertTrue(result.metadata["success"])
        self.assertEqual(result.data["item_count"], 0)
        self.assertEqual(result.data["summary"], "No media archive assets found matching 'NonExistentMission123'.")

    @patch("api.engine.tools.nasa.nasa_images.search_nasa_images")
    def test_nasa_images_tool_empty_later_page_messaging(self, mock_search):
        mock_search.return_value = {"count": 0, "items": []}
        tool = NASAImagesTool()
        result = tool.execute(self.context, query="Apollo 11", page=3)

        self.assertEqual(result.result_type, ResultType.NASA_IMAGES.value)
        self.assertTrue(result.metadata["success"])
        self.assertEqual(result.data["item_count"], 0)
        self.assertEqual(result.data["summary"], "No further media archive assets found on page 3 matching 'Apollo 11'.")

    @patch("api.engine.tools.nasa.nasa_images.search_nasa_images")
    def test_nasa_images_tool_total_hits_propagation(self, mock_search):
        mock_search.return_value = {
            "count": 1,
            "total_hits": 1420,
            "items": [{
                "nasa_id": "PIA9999",
                "title": "Cosmic Cloud",
                "description": "A cloud in space",
                "date_created": "2023-01-01T00:00:00Z",
                "center": "JPL",
                "keywords": ["Nebula"],
                "media_type": "image",
                "image_url": "http://nasa.gov/cloud.jpg"
            }]
        }
        tool = NASAImagesTool()
        result = tool.execute(self.context, query="Nebula", page=1)

        self.assertEqual(result.data["item_count"], 1)
        self.assertEqual(result.data["total_hits"], 1420)
        self.assertEqual(result.metadata["count"], 1)
        self.assertEqual(result.metadata["total_hits"], 1420)

    @patch("api.engine.tools.nasa.nasa_images.search_nasa_images")
    def test_nasa_images_tool_missing_total_hits_handled_gracefully(self, mock_search):
        mock_search.return_value = {
            "count": 1,
            "items": [{
                "nasa_id": "PIA9999",
                "title": "Cosmic Cloud",
                "image_url": "http://nasa.gov/cloud.jpg"
            }]
        }
        tool = NASAImagesTool()
        result = tool.execute(self.context, query="Nebula", page=1)

        self.assertEqual(result.data["item_count"], 1)
        self.assertNotIn("total_hits", result.data)
        self.assertNotIn("total_hits", result.metadata)

    @patch("api.engine.tools.nasa.nasa_images.search_nasa_images")
    def test_nasa_images_tool_query_relaxation(self, mock_search):
        mock_search.return_value = {
            "count": 1,
            "items": [{
                "nasa_id": "NH-OSIRIS-01",
                "title": "OSIRIS-REx Bennu Touchdown",
                "description": "Tag sample collection at asteroid Bennu.",
                "date_created": "2020-10-20T12:00:00Z",
                "center": "GSFC",
                "keywords": ["OSIRIS-REx", "Bennu"],
                "media_type": "image",
                "image_url": "https://images.nasa.gov/osiris.jpg"
            }],
            "query": "osiris-rex",
            "original_query": "celestial body osiris-rex mission"
        }

        tool = NASAImagesTool()
        result = tool.execute(self.context, query="celestial body osiris-rex mission")
        self.assertTrue(result.metadata.get("success"))
        self.assertEqual(len(result.discoveries), 1)
        self.assertEqual(result.data["query"], "osiris-rex")
        self.assertIn("refined from 'celestial body osiris-rex mission'", result.data["summary"])

    def test_nasa_images_tool_validation(self):
        tool = NASAImagesTool()
        with self.assertRaises(ValueError):
            tool.validate_arguments({})  # missing query

        with self.assertRaises(ValueError):
            tool.validate_arguments({"query": "   "})  # empty query

    @patch("api.engine.tools.nasa.nasa_images.search_nasa_images")
    def test_nasa_images_tool_api_failure(self, mock_search):
        mock_search.return_value = {"error": "NASA API endpoint returned 503."}

        tool = NASAImagesTool()
        result = tool.execute(self.context, query="Jupiter")

        self.assertEqual(result.result_type, "error")
        self.assertFalse(result.metadata.get("success"))
        self.assertEqual(result.data["error"], "NASA API endpoint returned 503.")
        self.assertEqual(len(result.discoveries), 0)

    # ============================================================
    # NASA EPIC EARTH IMAGERY (epic) TESTS
    # ============================================================

    @patch("api.engine.tools.nasa.epic.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.epic.get_epic_earth_imagery")
    def test_epic_tool_most_recent_success(self, mock_get_imagery, mock_get_key):
        mock_get_imagery.return_value = {
            "date": "2026-10-07",
            "count": 1,
            "images": [
                {
                    "identifier": "20261007001752",
                    "caption": "Full disc of Earth captured by EPIC",
                    "image_name": "epic_1b_20261007001752",
                    "date": "2026-10-07 00:13:03",
                    "image_url": "https://epic.gsfc.nasa.gov/archive/natural/2026/10/07/jpg/epic_1b_20261007001752.jpg",
                    "centroid_coordinates": {"lat": 3.33, "lon": 168.62}
                }
            ]
        }

        tool = EPICTool()
        result = tool.execute(self.context)

        mock_get_imagery.assert_called_once_with(date=None, api_key="mock_nasa_key")
        self.assertEqual(result.tool_name, "epic")
        self.assertEqual(result.result_type, ResultType.EPIC.value)
        self.assertTrue(result.metadata.get("success"))
        self.assertEqual(len(result.discoveries), 1)

        discovery = result.discoveries[0]
        self.assertEqual(discovery.source, "epic")
        self.assertEqual(discovery.external_id, "20261007001752")
        self.assertEqual(discovery.date, "2026-10-07")
        self.assertEqual(discovery.facts["Spacecraft"], "NOAA DSCOVR")
        self.assertIn("1 million miles", discovery.facts["Position"])
        self.assertEqual(discovery.facts["Center Latitude"], "3.33°")
        self.assertEqual(discovery.facts["Center Longitude"], "168.62°")
        # Ensure direct URL has no API key leaked
        self.assertEqual(discovery.media[0]["url"], "https://epic.gsfc.nasa.gov/archive/natural/2026/10/07/jpg/epic_1b_20261007001752.jpg")
        self.assertNotIn("mock_nasa_key", discovery.media[0]["url"])

    @patch("api.engine.tools.nasa.epic.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.epic.get_epic_earth_imagery")
    def test_epic_tool_specific_date_success(self, mock_get_imagery, mock_get_key):
        mock_get_imagery.return_value = {
            "date": "2026-10-05",
            "count": 1,
            "images": [
                {
                    "identifier": "20261005001752",
                    "caption": "Earth view",
                    "image_name": "epic_1b_20261005001752",
                    "date": "2026-10-05 00:13:03",
                    "image_url": "https://epic.gsfc.nasa.gov/archive/natural/2026/10/05/jpg/epic_1b_20261005001752.jpg",
                    "centroid_coordinates": {"lat": 0.0, "lon": 0.0}
                }
            ]
        }

        tool = EPICTool()
        result = tool.execute(self.context, date="2026-10-05")

        mock_get_imagery.assert_called_once_with(date="2026-10-05", api_key="mock_nasa_key")
        self.assertTrue(result.metadata.get("success"))
        self.assertEqual(result.discoveries[0].date, "2026-10-05")

    @patch("api.engine.tools.nasa.epic.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.epic.get_epic_earth_imagery")
    def test_epic_tool_empty_date_handling(self, mock_get_imagery, mock_get_key):
        mock_get_imagery.return_value = {
            "date": "1990-01-01",
            "count": 0,
            "images": []
        }

        tool = EPICTool()
        result = tool.execute(self.context, date="1990-01-01")

        self.assertEqual(result.result_type, ResultType.EPIC.value)
        self.assertTrue(result.metadata.get("success"))
        self.assertEqual(result.metadata["count"], 0)
        self.assertEqual(len(result.discoveries), 0)
        self.assertIn("No DSCOVR EPIC Earth imagery was captured", result.data["summary"])

    def test_epic_tool_date_validation(self):
        tool = EPICTool()
        with self.assertRaises(ValueError):
            tool.validate_arguments({"date": "invalid-date"})

        with self.assertRaises(ValueError):
            tool.validate_arguments({"date": "2026/10/07"})

        # Valid date succeeds
        validated = tool.validate_arguments({"date": "2026-10-07"})
        self.assertEqual(validated["date"], "2026-10-07")

    @patch("api.engine.tools.nasa.epic.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.epic.get_epic_earth_imagery")
    def test_epic_tool_api_failure(self, mock_get_imagery, mock_get_key):
        mock_get_imagery.return_value = {"error": "NASA API key was rejected.", "status_code": 401}

        tool = EPICTool()
        result = tool.execute(self.context, date="2026-10-05")

        mock_get_imagery.assert_called_once_with(date="2026-10-05", api_key="mock_nasa_key")
        self.assertEqual(result.result_type, "error")
        self.assertFalse(result.metadata.get("success"))
        self.assertEqual(result.data["error"], "NASA API key was rejected.")
        self.assertFalse(result.metadata["fallback_applied"])
        self.assertEqual(len(result.discoveries), 0)

    @patch("api.engine.tools.nasa.epic.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.epic.get_epic_earth_imagery")
    def test_epic_tool_fallback_on_future_empty_imagery(self, mock_get_imagery, mock_get_key):
        # First call with requested date returns empty images (e.g. future date or telemetry gap)
        # Second call with date=None returns latest available images
        mock_get_imagery.side_effect = [
            {"date": "2099-01-01", "count": 0, "images": []},
            {
                "date": "2026-10-05",
                "count": 1,
                "images": [
                    {
                        "identifier": "20261005001752",
                        "caption": "Earth view from DSCOVR",
                        "image": "epic_1b_20261005001752",
                        "date": "2026-10-05 00:13:03",
                        "centroid_coordinates": {"lat": 10.0, "lon": 20.0}
                    }
                ]
            }
        ]

        tool = EPICTool()
        result = tool.execute(self.context, date="2099-01-01")

        self.assertEqual(mock_get_imagery.call_count, 2)
        mock_get_imagery.assert_any_call(date="2099-01-01", api_key="mock_nasa_key")
        mock_get_imagery.assert_any_call(date=None, api_key="mock_nasa_key")

        self.assertTrue(result.metadata["success"])
        self.assertTrue(result.metadata["fallback_applied"])
        self.assertEqual(result.metadata["requested_date"], "2099-01-01")
        self.assertEqual(result.metadata["actual_date"], "2026-10-05")
        self.assertTrue(result.data["fallback_applied"])
        self.assertIn("Note: No DSCOVR EPIC Earth imagery was available for requested date '2099-01-01'", result.data["summary"])

        self.assertEqual(len(result.discoveries), 1)
        discovery = result.discoveries[0]
        self.assertEqual(discovery.date, "2026-10-05")
        self.assertEqual(discovery.external_id, "20261005001752")
        self.assertEqual(discovery.facts["Fallback Applied"], "Yes")
        self.assertEqual(discovery.facts["Requested Date"], "2099-01-01")
        self.assertEqual(discovery.facts["Actual Date"], "2026-10-05")

    @patch("api.engine.tools.nasa.epic.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.epic.get_epic_earth_imagery")
    def test_epic_tool_missing_identifier_does_not_produce_synthetic_id(self, mock_get_imagery, mock_get_key):
        # When identifier is missing/None, external_id must be None, not an index-based synthetic string
        mock_get_imagery.return_value = {
            "date": "2026-10-07",
            "count": 1,
            "images": [
                {
                    "identifier": None,
                    "caption": "Earth observation without identifier",
                    "image": "epic_1b_no_id",
                    "date": "2026-10-07 00:00:00",
                    "image_url": "https://epic.gsfc.nasa.gov/archive/natural/2026/10/07/jpg/epic_1b_no_id.jpg"
                }
            ]
        }
        tool = EPICTool()
        result = tool.execute(self.context, date="2026-10-07")

        self.assertTrue(result.metadata["success"])
        self.assertEqual(len(result.discoveries), 1)
        discovery = result.discoveries[0]
        self.assertIsNone(discovery.external_id)

    def test_nasa_images_pagination_bounds(self):
        tool = NASAImagesTool()
        self.assertEqual(tool.validate_arguments({"query": "JWST", "page": -5})["page"], 1)
        self.assertEqual(tool.validate_arguments({"query": "JWST", "page": 0})["page"], 1)
        self.assertEqual(tool.validate_arguments({"query": "JWST", "page": 200})["page"], 100)
        self.assertEqual(tool.validate_arguments({"query": "JWST", "page": 45})["page"], 45)

    @patch("api.engine.tools.nasa.nasa_images.search_nasa_images")
    def test_nasa_images_full_page_duplication_honest_empty_result(self, mock_search):
        # Create plan and discoveries with existing nasa_ids
        plan = SpacePlan.objects.create(user=self.user, prompt="JWST exploration", title="JWST Plan")
        Discovery.objects.create(
            space_plan=plan,
            source="nasa_images",
            external_id="PIA25001",
            type="nasa_images",
            title="JWST Deep Field 1",
            summary="Item 1"
        )
        Discovery.objects.create(
            space_plan=plan,
            source="nasa_images",
            external_id="PIA25002",
            type="nasa_images",
            title="JWST Deep Field 2",
            summary="Item 2"
        )

        mock_search.return_value = {
            "count": 2,
            "items": [
                {"nasa_id": "PIA25001", "title": "JWST Deep Field 1", "image_url": "http://nasa.gov/1.jpg"},
                {"nasa_id": "PIA25002", "title": "JWST Deep Field 2", "image_url": "http://nasa.gov/2.jpg"}
            ]
        }

        ctx = ToolExecutionContext(space_plan_id=plan.id, user_id=self.user.id)
        tool = NASAImagesTool()
        result = tool.execute(ctx, query="JWST", page=1)

        self.assertTrue(result.metadata["success"])
        self.assertTrue(result.metadata["all_items_already_exist"])
        self.assertEqual(result.metadata["returned_count"], 0)
        self.assertEqual(len(result.discoveries), 0)
        self.assertEqual(result.data["item_count"], 0)
        self.assertIn("already been added to this exploration plan", result.data["summary"])

    def test_discovery_source_choices_and_facts_dict_integrity(self):
        plan = SpacePlan.objects.create(user=self.user, prompt="Testing models", title="Test Plan")
        d_nasa = Discovery(
            space_plan=plan,
            source="nasa_images",
            external_id="PIA99999",
            type="nasa_images",
            title="NASA Image Asset",
            summary="A test asset"
        )
        d_nasa.full_clean()
        d_nasa.save()

        d_epic = Discovery(
            space_plan=plan,
            source="epic",
            external_id="epic_123",
            type="epic",
            title="EPIC Earth Asset",
            summary="Earth from space"
        )
        d_epic.full_clean()
        d_epic.save()

        # Check default facts is a dict
        self.assertIsInstance(d_nasa.facts, dict)
        self.assertIsInstance(d_epic.facts, dict)

    # ============================================================
    # REGISTRY & PERSISTENCE INTEGRATION TESTS
    # ============================================================

    def test_tool_registry_includes_new_tools(self):
        self.assertTrue(registry.has("nasa_images"))
        self.assertTrue(registry.has("epic"))
        self.assertTrue(registry.has("apod"))
        self.assertTrue(registry.has("neows"))
        self.assertTrue(registry.has("donki"))

        schemas = registry.get_openai_schemas()
        tool_names = [s["function"]["name"] for s in schemas]
        self.assertIn("nasa_images", tool_names)
        self.assertIn("epic", tool_names)

    @patch("api.engine.tools.nasa.nasa_images.search_nasa_images")
    def test_nasa_images_normalization_and_persistence(self, mock_search):
        mock_search.return_value = {
            "count": 1,
            "items": [
                {
                    "nasa_id": "PIA25000",
                    "title": "JWST Deep Field",
                    "description": "Deepest infrared view of the universe.",
                    "date_created": "2022-07-12T12:00:00Z",
                    "center": "GSFC",
                    "keywords": ["JWST", "Deep Field"],
                    "media_type": "image",
                    "image_url": "https://images-assets.nasa.gov/image/PIA25000/PIA25000~orig.jpg"
                }
            ]
        }
        tool = NASAImagesTool()
        tool_result = tool.execute(self.context, query="JWST")

        # ResultNormalizer
        orch_result = OrchestratorResult(
            success=True,
            tool_results=[tool_result],
            discoveries=tool_result.discoveries,
            llm_content="Analysis of JWST deep field observation."
        )
        normalized = ResultNormalizer.normalize(orch_result)
        self.assertEqual(normalized["result_type"], "nasa_images")
        self.assertEqual(normalized["content"]["item_count"], 1)

        # Persistence
        plan = SpacePlan.objects.create(user=self.user, title="JWST Exploration", prompt="Search JWST")
        interaction = Interaction.objects.create(
            space_plan=plan,
            user_prompt="Search JWST",
            interaction_type="find_more",
            status="pending"
        )
        ResultPersistenceService.persist_result(interaction, orch_result, self.user.id)

        interaction.refresh_from_db()
        self.assertEqual(interaction.status, "completed")
        self.assertEqual(interaction.added_discoveries.count(), 1)
        discovery = interaction.added_discoveries.first()
        self.assertEqual(discovery.source, "nasa_images")
        self.assertEqual(discovery.external_id, "PIA25000")
        self.assertEqual(discovery.title, "JWST Deep Field")

    @patch("api.engine.tools.nasa.epic.get_provider_key", return_value="mock_nasa_key")
    @patch("api.engine.tools.nasa.epic.get_epic_earth_imagery")
    def test_epic_normalization_and_persistence(self, mock_get_imagery, mock_get_key):
        mock_get_imagery.return_value = {
            "date": "2026-10-07",
            "count": 1,
            "images": [
                {
                    "identifier": "20261007009999",
                    "caption": "Earth view",
                    "image_name": "epic_1b_20261007009999",
                    "date": "2026-10-07 00:13:03",
                    "image_url": "https://epic.gsfc.nasa.gov/archive/natural/2026/10/07/jpg/epic_1b_20261007009999.jpg",
                    "centroid_coordinates": {"lat": 10.0, "lon": 20.0}
                }
            ]
        }
        tool = EPICTool()
        tool_result = tool.execute(self.context)

        # ResultNormalizer
        orch_result = OrchestratorResult(
            success=True,
            tool_results=[tool_result],
            discoveries=tool_result.discoveries,
            llm_content="EPIC observation report."
        )
        normalized = ResultNormalizer.normalize(orch_result)
        self.assertEqual(normalized["result_type"], "epic")
        self.assertEqual(normalized["content"]["image_count"], 1)

        # Persistence
        plan = SpacePlan.objects.create(user=self.user, title="Earth Exploration", prompt="Show Earth")
        interaction = Interaction.objects.create(
            space_plan=plan,
            user_prompt="Show Earth",
            interaction_type="find_more",
            status="pending"
        )
        ResultPersistenceService.persist_result(interaction, orch_result, self.user.id)

        interaction.refresh_from_db()
        self.assertEqual(interaction.status, "completed")
        self.assertEqual(interaction.added_discoveries.count(), 1)
        discovery = interaction.added_discoveries.first()
        self.assertEqual(discovery.source, "epic")
        self.assertEqual(discovery.external_id, "20261007009999")
        self.assertEqual(discovery.title, "Earth from Deep Space (2026-10-07)")

