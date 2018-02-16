/**
 * @abstract This contains the main logic for the context frame.
 * 	  It depends on Leaflet, Turf, and other libraries.
 * @author Andrea Ballatore <https://sites.google.com/site/andreaballatore/>
 * @date 2018
 */

// --------------------------------------------------------------------------------------------------------- //
// Global variables
// --------------------------------------------------------------------------------------------------------- //

// Map elements
map = null;
contextFrameLayer = null;
// counter of labels
n_labels = 0;

// Base maps
ACCESS_TOKEN = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';
MB_ATTR = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
			'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
			'Imagery © <a href="http://mapbox.com">Mapbox</a>';
MB_URL = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=' + ACCESS_TOKEN;
OSM_URL = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
OSM_ATTRIB = '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors';

assert(SORT_DISTANCE_WEIGHT+SORT_PARAM1_WEIGHT==100,"Incorrect parameters!");

//--------------------------------------------------------------------------------------------------------- //
// Util functions
//--------------------------------------------------------------------------------------------------------- //

function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

function roundToN(x,n){
	xx = Math.round(x/n)*n
	return(xx)
}

function rankObjects( objs, propName, rankName, inv=false ){
	var rank = 0;
	// sort objects for ranking
	if (inv){
		objs.sort(function(a, b){ return b.properties[propName] - a.properties[propName] });
	} else {
		objs.sort(function(a, b){ return a.properties[propName] - b.properties[propName] });
	}
	for (var i = 0; i < objs.length; i++) {
		//increase rank only if current score less than previous
		//if (i > 0 && objs[i][propName] < objs[i - 1][propName]) {
		rank++;
		objs[i].properties[rankName] = rank;
		//console.log(objs[i].properties);
	}
	return(objs);
}

function cutString( text, max_char ){
	res = text.substring(0,max_char);
	if (res.length < text.length){
		res += '...';
	}
	return(res);
}

function getRandomInRange(from, to, fixed) {
    return (Math.random() * (to - from) + from).toFixed(fixed) * 1;
    // .toFixed() returns string, so ' * 1' is a trick to convert to number
}

//--------------------------------------------------------------------------------------------------------- //
// App functions
//--------------------------------------------------------------------------------------------------------- //

/**
 * Init application, set up map and context frame.
 */
function initApp(){
	console.info("Init App");
	var params = getPageUrlParams();

	//console.debug(DEFAULT_CENTRE_LL);
	map = L.map('map');

	var osm_base_map = L.tileLayer(OSM_URL, {
	    attribution: OSM_ATTRIB,
	    minZoom: MIN_ZOOM,
	    maxZoom: MAX_ZOOM,
	    id: 'osm_base'
	});

	var Esri_WorldStreetMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
		attribution: 'Tiles &copy; Esri'
	});

	//osm_base_map.addTo(map);
	L.control.scale().addTo(map);

	var initZoom = DEFAULT_ZOOM;
	var initCentreLL = DEFAULT_CENTRE_LL;
	if (params != null){
		initZoom = params[0];
		initCentreLL = [params[1],params[2]];
	}
	map.setView( initCentreLL, initZoom );

	var baseLayers = {
		"ESRI": Esri_WorldStreetMap,
		"OSM": osm_base_map
	};

	contextFrameLayer = new L.LayerGroup();
	var overlays = {
		"ContextFrame": contextFrameLayer
	};
	L.control.layers(baseLayers,overlays).addTo(map);
	Esri_WorldStreetMap.addTo(map);
	map.addLayer(contextFrameLayer);

	// add controls
	if (OVERVIEW_MAP_ON){
		addOverviewMap();
	}
	addSearchBarNominatim();
	
	initBootleaf();

	initContextFrame();

	// activate random place button
	//document.getElementById('go_random_place').addEventListener("click", function(){
    //	goRandomPlace();
  	//});

	// set up event handlers
	map.on('moveend', function(e) { boundChanged(e); });
	map.on('movestart', function(e) {
		if (CONTEXT_FRAME_ON){
			showInMapConsole("Updating context frame...");
		}
	});
	map.on('load', function(e) { boundChanged(e); });

	check_spatial_data();
}

/**
 * Updates map zoom level and lat/lon in the page URL.
 */
function updateUrlParams(){
	var z = map.getZoom();
	var lat = map.getCenter().lat.toFixed(4);
	var lon = map.getCenter().lng.toFixed(4);
	document.location.hash = z+","+lat+","+lon;
}

/**
 * Returns page params after '#': z,lat,lon
 */
function getPageUrlParams(){
	var paramsStr = window.location.hash.substr(1);
	if (paramsStr.length < 1) return(null);
	var params = paramsStr.split(",");
	assert(params.length == 3,"URL params incorrect!");
	return(params);
}

/**
 * Returns whether cities should be shown in labels or not.
 */
function showCities(zoom){
	if ( zoom >= MIN_ZOOM_CITIES ) return true;
	return false;
}

/**
 * Returns whether countries should be shown in labels or not.
 */
function showCountries(zoom){
	return(!showCities(zoom));
}

/**
 * Add overview map to map. Based on https://github.com/areichman/leaflet-overview
 */
function addOverviewMap(){
	var osm2 = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
		  name: 'osm',
		  attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
		});

	L.control.overview([osm2]).addTo(map);
}

/**
 * Get random lat value (not full range).
 */
function getRandomLat(){
	// limited range to avoid deserts
	return(getRandomInRange(-55,70,4));
}

/**
 * Get random lon value (full range).
 */
function getRandomLon(){
	return(getRandomInRange(-180,180,4));
}

/**
 * Returns name for label, based on type and country.
 * US names get the state too.
 */
function getFeatureNameForLabel( featObj, className ){
	var name = cutString(featObj.properties.name, MAX_LABEL_CHARS);
	if (className=='cities'){
		if (featObj.properties.iso2 == 'US'){
			// add state name
			name += ", "+featObj.properties.province;
		} else {
			// add country code
			name += ", "+featObj.properties.iso2;
		}
	}
	return cutString(name, MAX_LABEL_CHARS);
}

/**
 * Returns a random city from dataset.
 */
function getRandomCity(){
	var i = getRandomInRange(0,world_cities.features.length-1)
	return(world_cities.features[i]);
}

/**
 * Returns random zoom level.
 */
function getRandomZoom(){
	return(getRandomInRange(MIN_ZOOM+3, MAX_ZOOM, 0)); // add +3 to avoid very large maps
}

/**
 * Check if spatial datasets are available.
 */
function check_spatial_data(){
	assert(world_cities,'world_cities not found');
	console.info(world_cities);
	assert(countries_json,'countries_json not found');
	console.info(countries_json);
}

/**
 * Triggers context frame update.
 */
function initContextFrame(){
	if (!CONTEXT_FRAME_ON) return;

	boundChanged(null);
	updateUrlParams();
}

/**
 * Triggered when bounds of map are changed by the user.
 */
function boundChanged(e){
	curBounds = map.getBounds();
	curZoom = map.getZoom();
	updateContextFrame(curBounds, curZoom);
	updateUrlParams();
}

/**
 * Calculate distance in km between a point and a polygon.
 */
function distanceBetweenPointAndPolygon(myPt, myPoly){
	is_within = turf.intersect(myPt, myPoly);
	if(is_within) return(0);
	var vertices = turf.explode(myPoly);
	var closestVertex = turf.nearest(myPt, vertices);
	var distanceKm = turf.distance(myPt, closestVertex);
	return(distanceKm);
}

/**
 * Core function.
 * Called at each map event, regenerates the whole context frame.
 */
function updateContextFrame(bounds, zoom){
	if (!CONTEXT_FRAME_ON) return;

	console.debug("updateContextFrame");
	cfBounds = getContextFrameBounds(bounds,zoom);
	n_feat = 0;
	// show countries
	if (showCountries(zoom)){
		selectedFeatures = findCfPolygons(countries_json, bounds, cfBounds);
		generateLabelsFromFeatures(selectedFeatures, bounds, zoom, 'countries');
		n_feat += selectedFeatures.length;
	}
	// show cities
	if (showCities(zoom)){
		selectedFeatures = findCfPoints(world_cities, bounds, cfBounds);
		generateLabelsFromFeatures(selectedFeatures, bounds, zoom, 'cities');
		n_feat += selectedFeatures.length;
	}

	showCfInfo(zoom,n_feat);
}

/**
 * Returns diagnostic text with context frame variables, to be displayed in user console.
 */
function showCfInfo(zoom,n_feat){
	var html = "Debug info: lat=" + map.getCenter().lat.toFixed(3) + "; lon=" + map.getCenter().lng.toFixed(3);
	html += "; zoom level="+zoom;
	html += "; min zoom cities="+MIN_ZOOM_CITIES;
	html += '; cities='+showCities(zoom);
	html += '; countries='+showCountries(zoom);
	html += '; selected features='+n_feat;
	html += '; max features='+MAX_LABELS;
	html += '; frame expansion='+EXPANSION_FACTOR;
	html += '; sort distance weight='+SORT_DISTANCE_WEIGHT;
	html += '; sort prop weight='+SORT_PARAM1_WEIGHT;
	showInMapConsole(html);
}

/**
 * Set up page elements (based on Bootleaf)
 */
function initBootleaf(){

	$(window).resize(function() {
	  sizeLayerControl();
	});

	$("#about-btn").click(function() {
	  $("#aboutModal").modal("show");
	  $(".navbar-collapse.in").collapse("hide");
	  return false;
	});

	$("#full-extent-btn").click(function() {
	  map.fitBounds(boroughs.getBounds());
	  $(".navbar-collapse.in").collapse("hide");
	  return false;
	});
	
	$("#random-place-btn").click(function() {
	  goRandomPlace();
	  $(".navbar-collapse.in").collapse("hide");
	  return false;
	});

	$("#legend-btn").click(function() {
	  $("#legendModal").modal("show");
	  $(".navbar-collapse.in").collapse("hide");
	  return false;
	});

	$("#nav-btn").click(function() {
	  $(".navbar-collapse").collapse("toggle");
	  return false;
	});

	function sizeLayerControl() {
		console.debug("sizeLayerControl");
		$(".leaflet-control-layers").css("max-height", $("#map").height() - 150);
	}
	
	// show footer
	$("#website_footer").show();

}

/**
 * Remove all labels from context frame.
 */
function clearLabels(){
	contextFrameLayer.clearLayers();
	n_labels = 0;
}

/**
 * Shows HTML code in the map console to the user.
 */
function showInMapConsole(htmlCode){
	document.getElementById('map_console').innerHTML = htmlCode;
}

/**
 * Calculate frame bounds in Lat/Lon coords, based on LABEL_PAD_PX_X and LABEL_PAD_PX_Y
 */
function calcMapFrameBounds(bounds){
	//var new_bounds = bounds.pad(LABEL_PAD);
	//console.error(bounds);
	// get screen coords
	var nePt = map.latLngToLayerPoint(bounds.getNorthEast());
	var swPt = map.latLngToLayerPoint(bounds.getSouthWest());
	nePt.x = nePt.x - LABEL_PAD_PX_X;
	nePt.y = nePt.y + LABEL_PAD_PX_Y;
	swPt.x = swPt.x + LABEL_PAD_PX_X;
	swPt.y = swPt.y - LABEL_PAD_PX_Y;
	var neLL = map.layerPointToLatLng(nePt);
	var swLL = map.layerPointToLatLng(swPt);
	var new_bounds = L.latLngBounds(swLL,neLL);
	//console.error(new_bounds);
	// map.layerPointToLatLng
	assert(bounds.contains(new_bounds),'calcMapFrameBounds: Incorrect bounds!');
	return new_bounds;
}

/**
 * Core function of context frame.
 * Generates labels from all candidates features, for a given bounding box and zoom level
 * (and type of features).
 * Slow function.
 */
function generateLabelsFromFeatures(features, bounds, zoom, labelClass){
	console.info('generateLabelsFromFeatures');
	clearLabels();
	bounds = calcMapFrameBounds( bounds ); // reduce bounds for labels
	var centerPt = turf.point([bounds.getCenter().lng, bounds.getCenter().lat]);
	var bbox = boundsToTurfBbox(bounds);
	//console.debug(features);
	all_intersections = [];
	for(i in features){
		currentFeature = features[i];
		fBbox = featureToTurfBbox(currentFeature);
		fCentroid = turf.centroid(currentFeature.geometry);
		// calculate label location
		//console.debug(fCentroid.geometry);
		// trace line between map center and feature centroid
		line = turf.lineString([ fCentroid.geometry.coordinates, centerPt.geometry.coordinates]);
		inters = lineIntersect(line, bbox); //currentFeature.geometry)
		if (inters.features.length>0){
			turf.featureEach(inters, function (curIntersection, intersIndex) {
				// check if feature is contained within current map bbox
				var dist = distanceBetweenPointAndPolygon(curIntersection, fBbox);
				curIntersection.properties.distKm = dist;
				curIntersection.properties.featName = getFeatureNameForLabel( currentFeature, labelClass );
				// calculate weights for features
				if (labelClass == 'cities'){
					curIntersection.properties.weight = currentFeature.properties.pop;
				}
				if (labelClass == 'countries'){
					curIntersection.properties.weight = Math.round(turf.area(currentFeature.geometry)/100000);
				}
				all_intersections.push(curIntersection);
				curIntersection.properties.fCentroid = fCentroid;
			});
		}
	}

	// sort labels
	all_intersections = sortCandidateLabels(all_intersections, labelClass);

	occupied_screen_coords = []; // keep track of screen slots to place labels
	//console.info(all_intersections);
	for(i in all_intersections){
		inters = all_intersections[i];
		if (inters.properties.distKm >= SHOW_MIN_DIST_KM && n_labels < MAX_LABELS){
			labLon = inters.geometry.coordinates[0];
			labLat = inters.geometry.coordinates[1];
			labelScreenPt = map.latLngToLayerPoint(L.latLng(labLat, labLon));
			//console.debug("rank="+inters.properties.rank+" "+inters.properties.featName);
			//console.debug(inters.properties);
			if (hasCollision( labelScreenPt, occupied_screen_coords )){
				//console.debug("  Label collision, skipping.");
				continue;
			}
			lab = styleText( inters.properties.featName, labelClass )+
					" <span style=\"color: gray; font-size: smaller;\">"+roundToN(inters.properties.distKm,10)+"km</span>";
			createLabel(lab, labLon, labLat, inters.properties.fCentroid);
			occupied_screen_coords.push(labelScreenPt);
			if (inters.properties.distKm > 0)
				createDirectionLine( turf.point([labLon,labLat]), inters.properties.fCentroid, labelClass );
		} else {
			//console.debug("Object too close or too many objects:")
			//console.debug(inters.properties);
		}
	}
}

/**
 * Sort candidate labels, based on a mix of distance from current map and population (only for cities).
 * Type is cities or countries.
 * Contains a core ranking formula based on SORT_DISTANCE_WEIGHT and SORT_PARAM1_WEIGHT.
 * Returns sorted objects.
 */
function sortCandidateLabels( intersections, type ){
	console.debug("sortCandidateLabels");

	// rank objects
	rankObjects(intersections,'distKm','distRank',   inv=false);
	rankObjects(intersections,'weight','weightRank', inv=true);

	// combine rankings based on weights
	for (var i = 0; i < intersections.length; i++) {
		// important function: calculate combine ranks
		intersections[i].properties.rank = combineWeightedRanks(
				intersections[i].properties.distRank, intersections[i].properties.weightRank,
				SORT_DISTANCE_WEIGHT, SORT_PARAM1_WEIGHT);
		intersections[i].properties.unweightedRank = combineWeightedRanks(
				intersections[i].properties.distRank, intersections[i].properties.weightRank,
				50, 50);
	}

	// final sort
	intersections.sort(function(a, b){ return a.properties.rank - b.properties.rank });

	var printableStr = '';
	for (var i = 0; i < intersections.length; i++) {
		printableStr += intersections[i].properties.featName  + ', ';
		if (i > 16) break;
		//console.log( intersections[i].properties.rank );
		//console.log( intersections[i].properties.featName );
		//console.log( intersections[i].properties );
		//console.log( intersections[i].properties + " ~ " + intersections[i].properties.distRank +
		//		" " + intersections[i].properties.weightRank);
	}
	console.debug("printableStr: dist="+SORT_DISTANCE_WEIGHT+" w="+SORT_PARAM1_WEIGHT);
	console.debug(printableStr);
	return(intersections);
}

/**
 * Combine two ranks with weights (sum==100)
 */
function combineWeightedRanks( r1, r2, w1, w2 ){
	/* R code for this function

	ranks = data.frame(r1 = sample(seq(30)), r2 = sample(seq(30)))
	ranks$unwei = (ranks$r1 + ranks$r2)/2
	w1 = 90
	w2 = 10
	ranks$wei = (ranks$r1 * w1 + ranks$r2 * w2)/100

	ranks$dist1 = abs(ranks$wei - ranks$r1)
	ranks$dist2 = abs(ranks$wei - ranks$r2)
	View(ranks)
	rm(ranks)

	*/
	assert(w1+w2==100,"combineWeightedRanks: invalid weights!");
	var val = (r1*w1+r2*w2)/100;
	return val;
}

/**
 * Check if a location on screen (scrnPt) is too close to locations that are already
 * occupied by labels (occupied_screen_coords).
 * The threshold used is MIN_PIXEL_DISTANCE.
 */
function hasCollision( scrnPt, occupied_screen_coords ){
	if (occupied_screen_coords.length==0) return(false);
	for(i in occupied_screen_coords){
		pt = occupied_screen_coords[i];
		// get distance in pixels
		distPx = scrnPt.distanceTo(pt);
		if (distPx < MIN_PIXEL_DISTANCE){
			return(true);
		}
	}
	return(false);
}

/**
 * Style some text with a given CSS class. Returns HTML.
 */
function styleText( text, cssClass ){
	html = "<span class=\""+cssClass+"\">"+text+"</span>";
	return(html)
}

/**
 * Move the map to a random city on Earth at a random zoom.
 */
function goRandomPlace(){
	console.debug("goRandomPlace");
	var city = getRandomCity();
	map.setView(new L.LatLng(city.geometry.coordinates[1], city.geometry.coordinates[0]), getRandomZoom());
	//map.setView(new L.LatLng(getRandomLat(), getRandomLon()), getRandomZoom());
}

/**
 * Find all intersections between a line and a polygon.
 */
function lineIntersect(line,poly){
	//console.debug('lineIntersect');
	var intersects = turf.lineIntersect(line, poly);
	//console.info(intersects);
	return(intersects);
}

/**
 * Create direction line between label and object located outside of the map.
 * The line is traced between origPt and destPt, and styled according to labelClass.
 * The line is clickable.
 */
function createDirectionLine( origPt, destPt, labelClass ){
	line = turf.lineString([ origPt.geometry.coordinates, destPt.geometry.coordinates]);
	if (labelClass == 'cities') color = '#006600';
	if (labelClass == 'countries') color = '#0066cc';

	directionLineStyle = {
		"color": color,
		"weight": 12,
		"opacity": .9
	};
	geoobj = L.geoJson(line, {
        style: directionLineStyle
    });
	geoobj.targetObjLonLat = destPt.geometry.coordinates;
    geoobj.addTo(contextFrameLayer);

    geoobj.on('click', function(event) {
    	// pan to feature
    	map.panTo(new L.LatLng(event.target.targetObjLonLat[1], event.target.targetObjLonLat[0]));
  	});
}

/**
 * Add search bar to map, based on https://github.com/stefanocudini/leaflet-search.
 */
function addSearchBarNominatim(){
	console.info("addSearchBarNominatim");
	map.addControl( new L.Control.Search({
		url: 'http://nominatim.openstreetmap.org/search?format=json&q={s}',
		jsonpParam: 'json_callback',
		propertyName: 'display_name',
		propertyLoc: ['lat','lon'],
		marker: L.circleMarker([0,0],{radius:30}),
		autoCollapse: true,
		autoType: false,
		minLength: 2
	}) );
}

/**
 * Create a label to be placed on the map at a given location with a given text.
 * It is a L.tooltip object.
 */
function createLabel( text, locationLon, locationLat, targetCoords ){
	var tooltip = L.tooltip({
		direction: 'center',
		permanent: true,
		interactive: true,
		noWrap: true,
		opacity: .95
	});
	tooltip.setContent( text  );
	tooltip.setLatLng(new L.LatLng(locationLat, locationLon));
	// add to map
	tooltip.addTo(contextFrameLayer);
	// activate click handler
	var el = tooltip.getElement();
	// set id
	el.id = "cf_label_"+n_labels;
	el.addEventListener('click', function(event) {
	    var lat = this.getAttribute('data-targetlat');
	    var lon = this.getAttribute('data-targetlon');
	    map.panTo(new L.LatLng(lat, lon));
	});
	// store lat/lon data for click event
	el.setAttribute('data-targetlon', targetCoords.geometry.coordinates[0]);
	el.setAttribute('data-targetlat', targetCoords.geometry.coordinates[1]);
	el.style.pointerEvents = 'auto'; // important to enable click handler
	// increase counter
	n_labels += 1;
}

/**
 * Convert Leaflet bounds into a bounding box in the Turf format.
 */
function boundsToTurfBbox( bounds ){
	// minX, minY, maxX, maxY
	//console.debug(bounds);
	var coords = [bounds.getEast(), bounds.getSouth(), bounds.getWest(), bounds.getNorth()];
	bbox = turf.bboxPolygon(coords);
	return(bbox)
}

/**
 * Calculate bounding box for a feature.
 */
function featureToTurfBbox( feat ){
	// minX, minY, maxX, maxY
	var bbox = turf.bbox(feat);

	// ugly fix for Russia bounding box
	if (feat.properties.name=='Russia'){
		//console.info('Russia');
		//console.info(bbox);
		bbox[0] = 27.06;
		bbox[2] = 180;
	}

	// ugly fix for US bounding box
	if (feat.properties.name=='United States of America'){
		//console.error('US');
		//console.info(bbox);
		bbox[0] = -124.8;
		bbox[2] = 180;
	}

	var bboxPolygon = turf.bboxPolygon(bbox);
	return(bboxPolygon);
}

/**
 * Find polygons in list features that are within the context frame bounds (cfBounds).
 * Slow query.
 */
function findCfPolygons( features, mapBounds, cfBounds ){
	assert(features,"findCfPolygons: features not found");
	selected = [];
	var cfBbox = boundsToTurfBbox(cfBounds);
	var centerPt = turf.point([mapBounds.getCenter().lng, mapBounds.getCenter().lat]);
	// for each feature in the data
	turf.featureEach(features, function (currentFeature, featureIndex) {
		fBbox = featureToTurfBbox(currentFeature);
		is_intersect = turf.intersect(fBbox, cfBbox);
		if (is_intersect != null){
			// found object
			selected.push(currentFeature);
		}
	});
	console.info("Selected features: "+selected.length);
	return(selected);
}

/**
 * Find points in list features that are within the context frame bounds (cfBounds).
 * Slow query.
 */
function findCfPoints( features, mapBounds, cfBounds ){
	selected = [];
	var cfBbox = boundsToTurfBbox(cfBounds);
	var mapBbox = boundsToTurfBbox(mapBounds);
	var centerPt = turf.point([mapBounds.getCenter().lng, mapBounds.getCenter().lat]);
	// for each feature in the data
	turf.featureEach(features, function (currentFeature, featureIndex) {
		//fBbox = featureToTurfBbox(currentFeature);
		is_in_context_frame = turf.booleanPointInPolygon(currentFeature.geometry, cfBbox);
		if (is_in_context_frame){
			is_in_map = turf.booleanPointInPolygon(currentFeature.geometry, mapBbox);
			if (!is_in_map){
				selected.push(currentFeature);
			}
		}
	});
	console.info("Selected features: "+selected.length);
	return(selected);
}

/**
 * Calculate bounding box to search for near objects based on the zoom level.
 * Exponentional function: EXPANSION_FACTOR**zoom
 */
function getContextFrameBounds(bounds, zoom){
	ratio = (EXPANSION_FACTOR**(zoom)).toFixed(2);
	console.info("getContextFrameBounds zoom="+zoom+" frame_expansion="+ratio);
	cfBounds = bounds.pad(ratio);
	return(cfBounds);
}

// Start app!
initApp();

// end