// DAB channels
var channels = ["5A", "5B", "5C", "5D", "6A", "6B", "6C", "6D", "7A", "7B",
"7C", "7D", "8A", "8B", "8C", "8D", "9A", "9B", "9C", "9D", "10A", "10B",
"10C", "10D", "11A", "11B", "11C", "11D", "12A", "12B", "12C", "12D", "13A",
"13B", "13C", "13D", "13E", "13F"];
var playing = false;
var dabServices = {}; // Will hold the loaded DAB services data
var dlsUpdateInterval = null; // Interval for updating DLS

// Parse configuration data
let stationList = [];
let favoritesList = [];
let currentStationIndex = 0;

// Load DAB services data on startup
async function loadDabServices() {
    try {
        const response = await fetch('/resources/dab_services.json');
        const services = await response.json();
        
        // Create a lookup map: service hex code -> service data
        services.forEach(service => {
            // Extract hex code from @id URL
            // Format: https://www.radiodns.uk/services/dab/ce1/ce15/c229/0
            const idParts = service['@id'].split('/');
            const hexCode = idParts[idParts.length - 2]; // Gets "c229"
            dabServices[hexCode] = service;
        });
        
        console.log('Loaded DAB services:', dabServices);
    } catch (err) {
        console.error('Error loading DAB services:', err);
    }
}

// Get logo filename from service ID
function getLogoFilename(url_mp3) {
    if (!url_mp3) return null;
    
    // Extract hex code from URL: /mp3/0xc229 -> c229
    const hexMatch = url_mp3.match(/0x([0-9a-fA-F]+)/);
    if (!hexMatch) return null;
    
    const hexCode = hexMatch[1].toLowerCase();
    const service = dabServices[hexCode];
    
    if (service && service.medium_name) {
        // Replace spaces with hyphens
        return service.medium_name.replace(/ /g, '-') + '.png';
    }
    
    return null;
}

function togglePlayPause() {
    if (playing) {
        stopPlayer();
        playing = false;
        document.getElementById('playPauseBtn').innerHTML = '<span class="material-symbols-rounded">play_arrow</span>';
        stopDlsUpdates();
    }
    else {
        setPlayerSource();
        playing = true;
        document.getElementById('playPauseBtn').innerHTML = '<span class="material-symbols-rounded">pause</span>';
        startDlsUpdates();
    }
}

// Start periodic DLS updates
function startDlsUpdates() {
    // Update immediately
    updateDls();
    // Then update every 3 seconds
    dlsUpdateInterval = setInterval(updateDls, 3000);
}

// Stop periodic DLS updates
function stopDlsUpdates() {
    if (dlsUpdateInterval) {
        clearInterval(dlsUpdateInterval);
        dlsUpdateInterval = null;
    }
    // Reset description to channel name
    if (stationList.length > 0) {
        const station = stationList[currentStationIndex];
        document.getElementById('stationDescription').textContent = `Channel ${station.channelName}`;
    }
}

// Update DLS from mux data
async function updateDls() {
    if (!playing || stationList.length === 0) return;
    
    try {
        const station = stationList[currentStationIndex];
        const muxData = await getMux(station.channelName);
        
        if (muxData && muxData.services) {
            // Find the current service in the mux data
            const service = muxData.services.find(s => s.sid === station.stationSId);
            
            if (service && service.dls && service.dls.label) {
                const dlsText = service.dls.label.trim();
                if (dlsText.length > 0) {
                    document.getElementById('stationDescription').textContent = dlsText;
                    console.log('DLS updated:', dlsText);
                } else {
                    document.getElementById('stationDescription').textContent = `Channel ${station.channelName}`;
                }
            }
        }
    } catch (err) {
        console.error('Error updating DLS:', err);
    }
}

function playerLoad() {
    console.log("player loading");
    document.getElementById("player").load();
    document.getElementById("player").play();
}

async function setPlayerSource() {
    const station = stationList[currentStationIndex];
    const url = station.url_mp3;
    console.log("Playing ",url);

    await postChannel(station.channelName);
    document.getElementById("player").src = "http://127.0.0.1:8888" + url;
    playerLoad();
}

function stopPlayer() {
    document.getElementById("player").src = "";
    playerLoad();
}

async function parseConfig() {
    // Load configuration from server in the correct order
    await loadStations();
    await loadFavorites();
    await loadLastStation(); // Load last station after stations are loaded
    
    if (stationList.length > 0) {
        updateDisplay();
    } else {
        document.getElementById('stationName').textContent = 'No Stations';
        document.getElementById('frequency').innerHTML = 'Click <span class="material-symbols-rounded" style="font-size: inherit; vertical-align: middle;">search</span> to scan';
        document.getElementById('stationDescription').textContent = 'Scan for available DAB channels';
    }
}

// Load stations from server
async function loadStations() {
    try {
        const response = await fetch('/stations');
        if (response.ok) {
            stationList = await response.json();
            console.log('Loaded stations from server:', stationList.length, 'stations');
            console.log('Station list:', stationList);
        } else {
            console.log('No stations found on server, status:', response.status);
        }
    } catch (err) {
        console.error('Error loading stations:', err);
    }
}

// Save stations to server
async function saveStations() {
    try {
        const response = await fetch('/stations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(stationList)
        });
        if (response.ok) {
            console.log('Saved stations to server');
        }
    } catch (err) {
        console.error('Error saving stations:', err);
    }
}

// Load favorites from server
async function loadFavorites() {
    try {
        const response = await fetch('/favourites');
        if (response.ok) {
            favoritesList = await response.json();
            console.log('Loaded favorites from server:', favoritesList);
            
            // Update station list with favorite status
            favoritesList.forEach(fav => {
                const station = stationList.find(s => s.stationSId === fav.stationSId);
                if (station) {
                    station.favorit = true;
                }
            });
        }
    } catch (err) {
        console.error('Error loading favorites:', err);
    }
}

// Save favorites to server
async function saveFavorites() {
    try {
        const response = await fetch('/favourites', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(favoritesList)
        });
        if (response.ok) {
            console.log('Saved favorites to server');
        }
    } catch (err) {
        console.error('Error saving favorites:', err);
    }
}

// Load last station from server
async function loadLastStation() {
    console.log('loadLastStation called, stationList length:', stationList.length);
    
    try {
        const response = await fetch('/laststation');
        if (response.ok) {
            const data = await response.json();
            console.log('Loaded last station data from server:', data);
            
            // Check if data has a 'laststation' property that's a string
            let lastStation = data;
            if (data.laststation && typeof data.laststation === 'string') {
                lastStation = JSON.parse(data.laststation);
            }
            
            console.log('Parsed last station:', lastStation);
            
            if (lastStation && lastStation.stationSId && stationList.length > 0) {
                console.log('Searching for station with SId:', lastStation.stationSId);
                const index = stationList.findIndex(s => s.stationSId === lastStation.stationSId);
                console.log('Found index:', index);
                
                if (index !== -1) {
                    currentStationIndex = index;
                    console.log('Set current station index to:', index, stationList[index].stationName);
                } else {
                    console.log('Last station not found in station list, SId:', lastStation.stationSId);
                    console.log('Available SIds:', stationList.map(s => s.stationSId));
                }
            } else {
                console.log('Cannot set last station - lastStation:', lastStation, 'stationList.length:', stationList.length);
            }
        } else {
            console.log('No last station found on server, status:', response.status);
        }
    } catch (err) {
        console.error('Error loading last station:', err);
    }
}

// Save last station to server
async function saveLastStation() {
    if (stationList.length === 0) return;
    
    try {
        const station = stationList[currentStationIndex];
        const response = await fetch('/laststation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(station)
        });
        if (response.ok) {
            console.log('Saved last station to server');
        }
    } catch (err) {
        console.error('Error saving last station:', err);
    }
}

function updateDisplay() {
    if (stationList.length === 0) return;

    const station = stationList[currentStationIndex];
    
    // Display station name in the frequency position
    document.getElementById('frequency').textContent = station.stationName.trim();
    
    // Display program type (ptystring) in the station name position
    document.getElementById('stationName').textContent = station.ptystring || 'Digital Radio';
    
    // Display channel name in the description
    document.getElementById('stationDescription').textContent = `Channel ${station.channelName}`;
    
    // Update station icon/logo
    const logoFilename = getLogoFilename(station.url_mp3);
    const iconElement = document.getElementById('stationIcon');
    if (logoFilename) {
        console.log('Loading logo:', logoFilename);
        iconElement.innerHTML = `<img src="/resources/${logoFilename}" alt="${station.stationName}" onerror="this.parentElement.innerHTML='<span class=\\'material-symbols-rounded\\'>sensors</span>'">`;
    } else {
        iconElement.innerHTML = '<span class="material-symbols-rounded">sensors</span>';
    }
    
    // Update favorite button - check both station.favorit flag and favoritesList
    const isFavorite = station.favorit === true || favoritesList.some(f => f.stationSId === station.stationSId);
    const favBtn = document.getElementById('favoriteBtn');
    console.log('Station favorite status:', station.stationName, 'isFavorite:', isFavorite, 'station.favorit:', station.favorit);
    
    if (isFavorite) {
        favBtn.innerHTML = '<span class="material-symbols-rounded" style="font-variation-settings: \'FILL\' 1, \'wght\' 400, \'GRAD\' 0, \'opsz\' 24;">heart_check</span>';
    } else {
        favBtn.innerHTML = '<span class="material-symbols-rounded" style="font-variation-settings: \'FILL\' 0, \'wght\' 400, \'GRAD\' 0, \'opsz\' 24;">favorite</span>';
    }
}

// Header controls
function closeApp() {
    console.log('Close app');
    alert('Close button clicked');
}

// Station controls
function toggleFavorite() {
    if (stationList.length === 0) return;
    
    const station = stationList[currentStationIndex];
    station.favorit = !station.favorit;
    
    const favIndex = favoritesList.findIndex(f => f.stationSId === station.stationSId);
    if (station.favorit && favIndex === -1) {
        favoritesList.push({
            stationName: station.stationName,
            stationSId: station.stationSId,
            channelName: station.channelName,
            favorit: true
        });
    } else if (!station.favorit && favIndex !== -1) {
        favoritesList.splice(favIndex, 1);
    }
    
    updateDisplay();
    saveFavorites();
    console.log('Favorites:', favoritesList);
}

// Playback controls (top row)
function showPlaylist() {
    console.log('Station list:', stationList);
    const stationNames = stationList.map((s, i) => 
        `${i === currentStationIndex ? '► ' : ''}${s.stationName.trim()}`
    ).join('\n');
    alert('Station List:\n\n' + stationNames);
}

async function scanChannels() {
    console.log('Starting channel scan...');
    let foundChannels = [];
    stationList = [];
    
    // Update display to show scanning status
    document.getElementById('stationName').textContent = 'Scanning...';
    document.getElementById('frequency').textContent = 'Please wait';
    document.getElementById('stationDescription').textContent = 'Initializing scan';
    
    for (const channel of channels) {
        // Update progress
        document.getElementById('frequency').textContent = `Scanning ${channel}`;
        document.getElementById('stationDescription').textContent = `Found ${stationList.length} stations so far`;
        
        console.log(`Scanning channel ${channel}...`);
        
        try {
            await postChannel(channel);
            const muxData = await getMux(channel);
            
            console.log(`Channel ${channel} mux data:`, muxData);
            
            if (muxData ) {
                
                if (muxData.services) {
                    console.log(`Found services on ${channel}`);

                    let audioServiceCount = 0;
                    
                    if (muxData.services && Array.isArray(muxData.services)) {
                        console.log(`  Processing ${muxData.services.length} services`);
                        
                        muxData.services.forEach((service, idx) => {
                            console.log(`  Service ${idx}:`, service.label?.label, 'transportmode:', service.components?.[0]?.transportmode);
                            
                            if (service.components && 
                                Array.isArray(service.components) && 
                                service.components.length > 0 &&
                                service.components[0].transportmode === 'audio') {
                                
                                if (service.label && service.label.label) {
                                    stationList.push({
                                        stationName: service.label.label,
                                        shortLabel: service.label.shortlabel || service.label.label.trim(),
                                        stationSId: service.sid,
                                        channelName: channel,
                                        url_mp3: service.url_mp3,
                                        ptystring: service.ptystring || '',
                                        favorit: false
                                    });
                                    audioServiceCount++;
                                    console.log(`    Added audio service: ${service.label.label}`);
                                }
                            }
                        });
                    }
                    
                    console.log(`  Total added ${audioServiceCount} audio services`);
                    
                    foundChannels.push({
                        channel: channel,
                        ensemble: channel,
                        serviceCount: audioServiceCount,
                        snr: muxData.demodulator.snr
                    });
                }
            }
        } catch (e) {
            console.error(`Error scanning channel ${channel}:`, e);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('Scan complete. Found channels:', foundChannels);
    console.log('Total stations:', stationList.length);
    console.log('Station list:', stationList);
    
    // Update display with scan results
    if (stationList.length > 0) {
        currentStationIndex = 0;
        updateDisplay();
        await saveStations();
    } else {
        document.getElementById('stationName').textContent = 'Scan Complete';
        document.getElementById('frequency').textContent = 'No stations found';
        document.getElementById('stationDescription').textContent = 'Try scanning again';
    }
    
}

async function postChannel(channelId) {
    console.log(`POST /channel: ${channelId}`);
    try {
        const response = await fetch("/channel", {
            method: "POST",
            headers: {
                "Content-Type": "text/plain"
            },
            body: channelId
        });

        const data = await response.text();
        console.log("Channel updated:", data);
        return { success: true, channel: data };
    } catch (err) {
        console.error("Error posting channel:", err);
    }
    return { success: false, channel: channelId };
}

async function getMux(channelId) {
    console.log(`GET /mux.json for channel: ${channelId}`);

    try {
        const response = await fetch("/mux.json");

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();
        console.log("MUX data:", data);
        return data;

    } catch (err) {
        console.error("Error fetching /mux.json:", err);
    }
}

function previousStation() {
    if (stationList.length === 0) return;
    currentStationIndex = (currentStationIndex - 1 + stationList.length) % stationList.length;
    updateDisplay();
    saveLastStation();
    if (playing) {
        setPlayerSource();
    }
    console.log('Previous station:', stationList[currentStationIndex]);
}

function previousFavorite() {
    for (let i = currentStationIndex - 1; i >= 0; i--) {
        if (stationList[i].favorit) {
            currentStationIndex = i;
            updateDisplay();
            saveLastStation();
            if (playing) {
                setPlayerSource();
            }
            console.log('Previous favorite:', stationList[currentStationIndex]);
            return;
        }
    }
    for (let i = stationList.length - 1; i > currentStationIndex; i--) {
        if (stationList[i].favorit) {
            currentStationIndex = i;
            updateDisplay();
            saveLastStation();
            if (playing) {
                setPlayerSource();
            }
            console.log('Previous favorite (wrapped):', stationList[currentStationIndex]);
            return;
        }
    }
    console.log('No previous favorite found');
}

function skipBackward() {
    currentStationIndex = Math.max(0, currentStationIndex - 5);
    updateDisplay();
    saveLastStation();
    if (playing) {
        setPlayerSource();
    }
    console.log('Skipped back 5 stations');
}

function togglePlay() {
    console.log('Playing:', stationList[currentStationIndex]);
    alert('Now playing: ' + stationList[currentStationIndex].stationName.trim());
}

function skipForward() {
    currentStationIndex = Math.min(stationList.length - 1, currentStationIndex + 5);
    updateDisplay();
    saveLastStation();
    if (playing) {
        setPlayerSource();
    }
    console.log('Skipped forward 5 stations');
}

function nextFavorite() {
    for (let i = currentStationIndex + 1; i < stationList.length; i++) {
        if (stationList[i].favorit) {
            currentStationIndex = i;
            updateDisplay();
            saveLastStation();
            if (playing) {
                setPlayerSource();
            }
            console.log('Next favorite:', stationList[currentStationIndex]);
            return;
        }
    }
    for (let i = 0; i < currentStationIndex; i++) {
        if (stationList[i].favorit) {
            currentStationIndex = i;
            updateDisplay();
            saveLastStation();
            if (playing) {
                setPlayerSource();
            }
            console.log('Next favorite (wrapped):', stationList[currentStationIndex]);
            return;
        }
    }
    console.log('No next favorite found');
}

function nextStation() {
    if (stationList.length === 0) return;
    currentStationIndex = (currentStationIndex + 1) % stationList.length;
    updateDisplay();
    saveLastStation();
    if (playing) {
        setPlayerSource();
    }
    console.log('Next station:', stationList[currentStationIndex]);
}

// Load DAB services on page load
loadDabServices();
parseConfig();
