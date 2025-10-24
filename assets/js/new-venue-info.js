document.addEventListener('DOMContentLoaded', async function() {
    const detailsDiv = document.getElementById('place-details')
    const createBtn = document.getElementById('create-venue-btn')
    const messageDiv = document.getElementById('message')

    function showMessage(text, isError = false) {
        messageDiv.textContent = text
        messageDiv.style.color = isError ? 'red' : 'green'
    }

    const session = await window.checkAuth()

    if (!session) {
        showMessage('Not authenticated. Redirecting to login...', true)
        setTimeout(() => {
            window.location.href = window.BASEURL || '/'
        }, 2000)
        return
    }

    const urlParams = new URLSearchParams(window.location.search)
    const placeId = urlParams.get('place_id')

    if (!placeId) {
        showMessage('No place ID provided.', true)
        detailsDiv.innerHTML = 'No place ID provided.'
        return
    }

    detailsDiv.innerHTML = 'Loading...'

    let place
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/lookup?format=json&osm_ids=${placeId}&accept-language=en`)
        const results = await response.json()
        if (results.length === 0) {
            showMessage('Place not found.', true)
            detailsDiv.innerHTML = 'Place not found.'
            return
        }
        place = results[0]
    } catch (error) {
        showMessage('Error fetching place details: ' + error.message, true)
        detailsDiv.innerHTML = 'Error fetching place details.'
        return
    }

    // Display place details
    const address = place.address || {}
    const parsedAddress1 = (address.house_number ? address.house_number + ' ' : '') + (address.road || '')
    const parsedAddress2 = address.suburb || address.neighbourhood || ''
    const parsedCity = address.city || address.town || address.village || address.hamlet || ''
    const parsedSubdivision = address.state || address.county || ''

    // Activity types TODO: get these from supabase
    const activityTypes = ['lunch', 'dinner', 'drinks', 'hike']

    const selectedActivities = []

    function updateActivitiesDisplay() {
        const activitiesList = document.getElementById('activities-list')
        activitiesList.innerHTML = ''
        if (selectedActivities.length === 0) {
            activitiesList.textContent = 'None'
        } else {
            selectedActivities.forEach(activity => {
                const activityDiv = document.createElement('div')
                activityDiv.innerHTML = `${activity} <button class="remove-activity" data-activity="${activity}">Remove</button>`
                activitiesList.appendChild(activityDiv)
            })
            // Add event listeners to remove buttons
            document.querySelectorAll('.remove-activity').forEach(btn => {
                btn.addEventListener('click', function() {
                    const activity = this.getAttribute('data-activity')
                    const index = selectedActivities.indexOf(activity)
                    if (index > -1) {
                        selectedActivities.splice(index, 1)
                        updateActivitiesDisplay()
                    }
                })
            })
        }
    }

    // Auto-detect activities from OSM data
    if (place.type) {
        if (place.type === 'restaurant') {
            if (!selectedActivities.includes('lunch')) selectedActivities.push('lunch')
            if (!selectedActivities.includes('dinner')) selectedActivities.push('dinner')
        } else if (place.type === 'bar' || place.type === 'pub') {
            if (!selectedActivities.includes('drinks')) selectedActivities.push('drinks')
        } else if (place.type === 'park' || place.class === 'leisure') {
            if (!selectedActivities.includes('hike')) selectedActivities.push('hike')
        }
    }

    detailsDiv.innerHTML = `
        <p><strong>Location Name:</strong> ${place.display_name.split(',')[0]}</p>
        <p><strong>Address 1:</strong> ${parsedAddress1 || 'N/A'}</p>
        <p><strong>Address 2:</strong> ${parsedAddress2 || 'N/A'}</p>
        <p><strong>City:</strong> ${parsedCity || 'N/A'}</p>
        <p><strong>Postal Code:</strong> ${address.postcode || 'N/A'}</p>
        <p><strong>Subdivision:</strong> ${parsedSubdivision || 'N/A'}</p>
        <p><strong>Country:</strong> ${address.country || 'N/A'} (${(address.country_code || '').toUpperCase()})</p>
        <p><strong>Coordinates:</strong> ${place.lat}, ${place.lon}</p>
        <p><strong>Associated Activities:</strong> <select id="activity-select">
                <option value="">Select activity type</option>
                ${activityTypes.map(type => `<option value="${type}">${type}</option>`).join('')}
            </select> <button id="add-activity-btn">Add</button> <div id="activities-list"></div></p>
    `

    updateActivitiesDisplay()

    document.getElementById('add-activity-btn').addEventListener('click', function() {
        const select = document.getElementById('activity-select')
        const selected = select.value
        if (selected && !selectedActivities.includes(selected)) {
            selectedActivities.push(selected)
            updateActivitiesDisplay()
        }
        select.value = ''
    })

    // Set map iframe
    const lat = parseFloat(place.lat)
    const lon = parseFloat(place.lon)
    const bbox = `${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}`
    const iframe = document.getElementById('map-iframe')
    iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`

    createBtn.addEventListener('click', async function() {
        const venueData = {
            country: (address.country_code || '').toUpperCase(),
            location_name: place.display_name.split(',')[0],
            address_1: (address.house_number ? address.house_number + ' ' : '') + (address.road || ''),
            address_2: address.suburb || address.neighbourhood || '',
            city: address.city || address.town || address.village || address.hamlet || '',
            postal_code: address.postcode || '',
            subdivision: address.state || address.county || '',
            coordinates: { type: "Point", coordinates: [parseFloat(place.lon), parseFloat(place.lat)] }
        }

        try {
            const { data: venue, error } = await window.supabaseClient
                .from('venues')
                .insert([venueData])
                .select('id')
                .single()

            if (error) {
                showMessage('Error creating venue: ' + error.message, true)
            } else {
                // Insert associated activities
                if (selectedActivities.length > 0) {
                    const activitiesData = selectedActivities.map(activity => ({
                        venue_id: venue.id,
                        activity_type: activity
                    }))
                    const { error: actError } = await window.supabaseClient
                        .from('venue_associated_activities')
                        .insert(activitiesData)
                    if (actError) {
                        showMessage('Venue created but error adding activities: ' + actError.message, true)
                    } else {
                        showMessage('Venue created successfully!')
                    }
                } else {
                    showMessage('Venue created successfully!')
                }
                setTimeout(() => {
                    window.location.href = window.BASEURL + '/dashboard.html'
                }, 2000)
            }
        } catch (error) {
            showMessage('Error: ' + error.message, true)
        }
    })
})