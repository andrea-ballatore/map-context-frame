/**
 * @abstract This contains the main logic for the context frame.
 * 	  It depends on Leaflet, Turf, and other libraries.
 * @author Andrea Ballatore <https://sites.google.com/site/andreaballatore/>
 * @date 2018
 */

//--------------------------------------------------------------------------------------------------------- //
// Context Frame Settings
//--------------------------------------------------------------------------------------------------------- //

// top settings
CONTEXT_FRAME_ON = true;
OVERVIEW_MAP_ON = false;

// default map center (London)
DEFAULT_CENTRE_LL = [51.505, -0.09];
//DEFAULT_CENTRE_LL = [getRandomLat(), getRandomLon()];

// min zoom level in the map
MIN_ZOOM = 3;
// max zoom level in the map
MAX_ZOOM = 18;
// default zoom level in the map
DEFAULT_ZOOM = 7;
// Offsets of context frame in pixels, to calculate space to place labels in the frame
LABEL_PAD_PX_X = 70; // left and right borders
LABEL_PAD_PX_Y = 27; // top and bottom borders

// maximum number of labels to be displayed on the map
MAX_LABELS = 12;
// filter labels that are closer than this threshold.
// if SHOW_MIN_DIST_KM == 0, show labels about objects that are visibile in the map.
SHOW_MIN_DIST_KM = 10;
// Maximum number of characters in a label. Prevents labels being too long.
MAX_LABEL_CHARS = 15;
// Expansion factor used to query the geographic space around the map (exponential).
// Higher values will increase the query area.
EXPANSION_FACTOR = 1.4;
// Cities will be shown at zoom levels >= than this.
MIN_ZOOM_CITIES = 8; // 16;
// Minimum distance between labels on screen. Prevents label collisions.
MIN_PIXEL_DISTANCE = 110;

// Weights to determine order/priority of labels.
// sum should be 100.
SORT_DISTANCE_WEIGHT = 80; // weight of feature distance to the current map
SORT_PARAM1_WEIGHT = 20; // weight of feature property (population, area, etc.)

// end