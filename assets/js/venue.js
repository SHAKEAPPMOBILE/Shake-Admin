document.addEventListener('DOMContentLoaded', async function () {
    const detailsDiv = document.getElementById('venue-details')
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
    const venueId = urlParams.get('id')

    if (!venueId) {
        showMessage('No venue ID provided.', true)
        detailsDiv.innerHTML = 'No venue ID provided.'
        return
    }

    detailsDiv.innerHTML = 'Loading...'

    try {
        const { data: venue, error } = await window.supabaseClient
            .from('venues')
            .select('*, venue_associated_activities(*)')
            .eq('id', venueId)
            .single()

        if (error) {
            showMessage('Error loading venue: ' + error.message, true)
            detailsDiv.innerHTML = 'Error loading venue.'
        } else if (!venue) {
            showMessage('Venue not found.', true)
            detailsDiv.innerHTML = 'Venue not found.'
        } else {
            const associatedActivities = venue.venue_associated_activities?.map(act => act.activity_type).join(', ') || 'None'
            detailsDiv.innerHTML = `
                <p><strong>ID:</strong> ${venue.id}</p>
                <p><strong>Location Name:</strong> ${venue.location_name}</p>
                <p><strong>Address 1:</strong> ${venue.address_1}</p>
                <p><strong>Address 2:</strong> ${venue.address_2 || 'N/A'}</p>
                <p><strong>City:</strong> ${venue.city}</p>
                <p><strong>Postal Code:</strong> ${venue.postal_code || 'N/A'}</p>
                <p><strong>Subdivision:</strong> ${venue.subdivision || 'N/A'}</p>
                <p><strong>Country:</strong> ${venue.country}</p>
                <p><strong>Coordinates:</strong> ${venue.coordinates ? `${venue.coordinates.coordinates[1]}, ${venue.coordinates.coordinates[0]}` : 'N/A'}</p>
                <p><strong>Associated Activities:</strong> ${associatedActivities}</p>
                <p><strong>Created At:</strong> ${new Date(venue.created_at).toLocaleString()}</p>
                <p><strong>Updated At:</strong> ${new Date(venue.updated_at).toLocaleString()}</p>
            `

            // Set map iframe
            if (venue.coordinates) {
                const lat = venue.coordinates.coordinates[1]
                const lng = venue.coordinates.coordinates[0]
                const bbox = `${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}`
                const iframe = document.getElementById('map-iframe')
                iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
            }

            document.getElementById('delete-venue-btn').addEventListener('click', async function () {
                if (confirm('Are you sure you want to delete this venue?')) {
                    try {
                        const { error } = await window.supabaseClient
                            .from('venues')
                            .delete()
                            .eq('id', venueId)

                        if (error) {
                            showMessage('Error deleting venue: ' + error.message, true)
                        } else {
                            // Verify deletion
                            const { data: checkVenue, error: checkError } = await window.supabaseClient
                                .from('venues')
                                .select('id')
                                .eq('id', venueId)
                                .single()

                            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
                                showMessage('Error verifying deletion: ' + checkError.message, true)
                            } else if (checkVenue) {
                                showMessage('Deletion failed: insufficient permissions', true)
                            } else {
                                showMessage('Venue deleted successfully!')
                                setTimeout(() => {
                                    window.location.href = window.BASEURL + '/dashboard.html'
                                }, 2000)
                            }
                        }
                    } catch (error) {
                        showMessage('Error: ' + error.message, true)
                    }
                }
            })
        }
    } catch (error) {
        showMessage('Error: ' + error.message, true)
    }
})