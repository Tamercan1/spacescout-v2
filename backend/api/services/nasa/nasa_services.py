import httpx
import json
import os
import re
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("NASA_API_KEY")

NASA_APOD_URL = "https://api.nasa.gov/planetary/apod"
NASA_NEO_URL = "https://api.nasa.gov/neo/rest/v1/feed"
NASA_FLR_URL = "https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR"
NASA_IMAGES_SEARCH_URL = "https://images-api.nasa.gov/search"
NASA_EPIC_URL = "https://api.nasa.gov/EPIC/api/natural"


class APIError(str):
    """String subclass that carries optional HTTP status_code, error_type, and details."""
    def __new__(cls, message: str, status_code: int | None = None, error_type: str = "unknown", details: str | None = None):
        obj = super().__new__(cls, message)
        obj.status_code = status_code
        obj.error_type = error_type
        obj.details = details or ""
        return obj


def get(url, params, timeout=15):
    try:
        response = httpx.get(url, params=params, timeout=timeout, follow_redirects=True)
        response.raise_for_status()

        content_type = response.headers.get("content-type", "")
        if "json" not in content_type and not response.text.strip().startswith(("{", "[")):
            if str(response.url) != url:
                return None, APIError(f"NASA API endpoint redirected unexpectedly to {response.url}", status_code=302, error_type="redirect")
            return None, APIError("NASA API returned a non-JSON response.", status_code=200, error_type="invalid_format")

        return response.json(), None

    except httpx.HTTPStatusError as err:
        status = err.response.status_code
        if status in [301, 302, 307, 308]:
            loc = err.response.headers.get("Location", "")
            return None, APIError(f"NASA API returned redirect (status {status}) to {loc}.", status_code=status, error_type="redirect")
        elif status == 429:
            message = "NASA API rate limit reached. Try again later."
            return None, APIError(message, status_code=429, error_type="rate_limit")
        elif status in [401, 403]:
            message = "NASA API key was rejected. Check NASA_API_KEY."
            return None, APIError(message, status_code=status, error_type="auth_error")
        elif status == 400:
            detail = ""
            try:
                err_json = err.response.json()
                if isinstance(err_json, dict):
                    detail = err_json.get("msg") or err_json.get("message") or err_json.get("error") or ""
            except Exception:
                try:
                    detail = err.response.text.strip()[:200]
                except Exception:
                    detail = ""
            message = f"NASA API returned an error (status 400): {detail}" if detail else f"NASA API returned an error (status 400)."
            return None, APIError(message, status_code=400, error_type="bad_request", details=detail)
        elif status == 404:
            message = f"NASA API returned an error (status {status})."
            return None, APIError(message, status_code=404, error_type="not_found")
        else:
            message = f"NASA API returned an error (status {status})."
            return None, APIError(message, status_code=status, error_type="server_error" if status >= 500 else "http_error")

    except httpx.RequestError:
        return None, APIError("Network Error: Could not reach the NASA API.", status_code=None, error_type="network_error")


# GET ASTRONOMY PICTURES USING NASA'S APOD
def get_astronomy_picture(date=None, api_key=None):
    qparams = {
        "api_key": api_key or API_KEY
    }

    if date:
        qparams["date"] = date

    data, error = get(NASA_APOD_URL, qparams)

    if error:
        res = {"error": str(error)}
        if hasattr(error, "status_code") and error.status_code is not None:
            res["status_code"] = error.status_code
        if hasattr(error, "error_type") and error.error_type is not None:
            res["error_type"] = error.error_type
        if hasattr(error, "details") and error.details:
            res["details"] = error.details
        return res

    try:
        return {
            "date": data["date"],
            "title": data["title"],
            "explanation": data["explanation"],
            "image_url": data["url"],
            "media_type": data["media_type"],
            "source": "NASA"
        }
    except KeyError:
        return {
            "error": "Unexpected NASA API response."
        }


# GET NEAR EART OBJECTS USING NASA'S NEOWS
def search_near_earth_objects(start_date, end_date, api_key=None):
    qparams = {
        "api_key": api_key or API_KEY,
        "start_date": start_date,
        "end_date": end_date
    }

    data, error = get(NASA_NEO_URL, qparams)

    if error:
        return {
            "error": error
        }

    objects = []

    try:
        for date, asteroids in data["near_earth_objects"].items():
            for asteroid in asteroids:
                objects.append({
                    "id": asteroid["id"],
                    "name": asteroid["name"],
                    "date": date,
                    "estimated_diameter_km": {
                        "min": asteroid["estimated_diameter"]["kilometers"]["estimated_diameter_min"],
                        "max": asteroid["estimated_diameter"]["kilometers"]["estimated_diameter_max"]
                    },
                    "miss_distance_km": asteroid["close_approach_data"][0]["miss_distance"]["kilometers"],
                    "is_potentially_hazardous": asteroid["is_potentially_hazardous_asteroid"],
                    "nasa_jpl_url": asteroid["nasa_jpl_url"]
                })
    except KeyError:
        return {
            "error": "Unexpected NASA API response."
        }

    return {
        "count": len(objects),
        "objects": objects
    }


# GET SOLAR FLARES USING NASA'S DONKI FLR
def get_solar_flares(start_date, end_date, api_key=None):
    qparams = {
        "startDate": start_date,
        "endDate": end_date,
    }
    if api_key or API_KEY:
        qparams["api_key"] = api_key or API_KEY

    data, error = get(NASA_FLR_URL, qparams)

    if error:
        return {
            "error": error
        }

    flares = []

    try:
        for flare in data:
            flares.append({
                "id": flare["flrID"],
                "start_time": flare["beginTime"],
                "peak_time": flare["peakTime"],
                "end_time": flare["endTime"],
                "class": flare["classType"],
                "source_location": flare.get("sourceLocation", ""),
                "active_region": flare.get("activeRegionNum", ""),
                "note": flare.get("note", ""),
                "url": flare["link"]
            })
    except (KeyError, TypeError):
        return {
            "error": "Unexpected NASA API response format."
        }

    return {
        "count": len(flares),
        "flares": flares
    }


def _parse_nasa_images_total_hits(data: dict) -> int | None:
    try:
        raw_hits = data.get("collection", {}).get("metadata", {}).get("total_hits")
        if raw_hits is not None:
            return int(raw_hits)
    except (ValueError, TypeError, AttributeError):
        pass
    return None


def _parse_nasa_images_collection(data: dict) -> list[dict]:
    items = []
    raw_items = data.get("collection", {}).get("items", [])
    for item in raw_items:
        data_list = item.get("data", [])
        if not data_list:
            continue
        d = data_list[0]
        links = item.get("links", [])
        image_url = links[0].get("href") if links else None

        items.append({
            "nasa_id": d.get("nasa_id"),
            "title": d.get("title", "NASA Asset"),
            "description": d.get("description", ""),
            "date_created": d.get("date_created"),
            "center": d.get("center"),
            "keywords": d.get("keywords", []),
            "media_type": d.get("media_type", "image"),
            "image_url": image_url
        })
    return items


# SEARCH NASA IMAGE AND VIDEO LIBRARY
def search_nasa_images(query: str, media_type: str = "image", page: int = 1):
    qparams = {
        "q": query,
        "media_type": media_type,
        "page": page
    }

    data, error = get(NASA_IMAGES_SEARCH_URL, qparams)

    if error:
        return {
            "error": error
        }

    try:
        items = _parse_nasa_images_collection(data)
        total_hits = _parse_nasa_images_total_hits(data)
    except (KeyError, TypeError, AttributeError):
        return {
            "error": "Unexpected NASA Images API response format."
        }

    # Query relaxation fallback: If multi-term query yielded 0 results, strip generic category/filler words
    if not items and " " in query.strip():
        stop_words = {
            "celestial", "body", "bodies", "and", "the", "mission", "missions",
            "photo", "photos", "image", "images", "picture", "pictures", "of", "in", "a", "an", "for"
        }
        tokens = [w for w in re.findall(r"[\w-]+", query) if w.lower() not in stop_words]
        cleaned_query = " ".join(tokens).strip()

        if cleaned_query and cleaned_query.lower() != query.strip().lower():
            fallback_params = {
                "q": cleaned_query,
                "media_type": media_type,
                "page": page
            }
            fb_data, fb_error = get(NASA_IMAGES_SEARCH_URL, fallback_params)
            if not fb_error and fb_data:
                try:
                    fb_items = _parse_nasa_images_collection(fb_data)
                    fb_total_hits = _parse_nasa_images_total_hits(fb_data)
                    if fb_items:
                        res = {
                            "count": len(fb_items),
                            "items": fb_items,
                            "query": cleaned_query,
                            "original_query": query
                        }
                        if fb_total_hits is not None:
                            res["total_hits"] = fb_total_hits
                        return res
                except Exception:
                    pass

    res = {
        "count": len(items),
        "items": items
    }
    if total_hits is not None:
        res["total_hits"] = total_hits
    return res


# GET FULL-DISC EARTH IMAGERY USING NASA'S EPIC CAMERA ON DSCOVR
def get_epic_earth_imagery(date: str | None = None, api_key: str | None = None):
    if date:
        url = f"{NASA_EPIC_URL}/date/{date}"
    else:
        url = NASA_EPIC_URL

    qparams = {}
    if api_key or API_KEY:
        qparams["api_key"] = api_key or API_KEY

    data, error = get(url, qparams)

    if error:
        res = {"error": str(error)}
        if hasattr(error, "status_code") and error.status_code is not None:
            res["status_code"] = error.status_code
        if hasattr(error, "error_type") and error.error_type is not None:
            res["error_type"] = error.error_type
        if hasattr(error, "details") and error.details:
            res["details"] = error.details
        return res

    if not isinstance(data, list):
        return {
            "error": "Unexpected NASA EPIC API response format."
        }

    images = []

    try:
        for item in data:
            identifier = item.get("identifier")
            image_name = item.get("image")
            dt_str = item.get("date", "")

            # Construct direct public archive URL without exposing secrets
            image_url = ""
            if image_name and dt_str:
                parts = dt_str.split()[0].split("-")
                if len(parts) == 3:
                    year, month, day = parts
                    image_url = f"https://epic.gsfc.nasa.gov/archive/natural/{year}/{month}/{day}/jpg/{image_name}.jpg"

            centroid = item.get("centroid_coordinates") or {}
            images.append({
                "identifier": identifier,
                "caption": item.get("caption", ""),
                "image_name": image_name,
                "date": dt_str,
                "image_url": image_url,
                "centroid_coordinates": {
                    "lat": centroid.get("lat"),
                    "lon": centroid.get("lon")
                } if centroid else None,
                "sun_j2000_position": item.get("sun_j2000_position"),
                "lunar_j2000_position": item.get("lunar_j2000_position"),
                "dscovr_j2000_position": item.get("dscovr_j2000_position")
            })
    except (KeyError, TypeError, AttributeError):
        return {
            "error": "Unexpected NASA EPIC API item format."
        }

    obs_date = date or (images[0]["date"].split()[0] if images and images[0].get("date") else "")
    return {
        "date": obs_date,
        "count": len(images),
        "images": images
    }
