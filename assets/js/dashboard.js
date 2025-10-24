document.addEventListener('DOMContentLoaded', async function() {
    const userEmailSpan = document.getElementById('user-email')
    const userDataDiv = document.getElementById('user-data')
    const messageDiv = document.getElementById('message')

    function showMessage(text, isError = false) {
        messageDiv.textContent = text
        messageDiv.style.color = isError ? 'red' : 'green'
    }

    userDataDiv.innerHTML = 'Loading...'
    document.getElementById('venues-tbody').innerHTML = '<tr><td colspan="7">Loading...</td></tr>'

    const session = await window.checkAuth()

    try {
        const { data: { session: currentSession }, error } = await window.supabaseClient.auth.getSession()

        if (error || !currentSession) {
            showMessage('Not authenticated. Redirecting to login...', true)
            setTimeout(() => {
                window.location.href = window.BASEURL || '/'
            }, 2000)
            return
        }

        const user = currentSession.user
        userEmailSpan.textContent = user.email

        // Fetch user role
        let role = 'Normal user'
        const { data: userRole, error: roleError } = await supabaseClient
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        if (!roleError && userRole) {
            role = userRole.role
        }

        userDataDiv.innerHTML = `
            <p><strong>User ID:</strong> ${user.id}</p>
            <p><strong>Role:</strong> ${role}</p>
            <p><strong>Created:</strong> ${new Date(user.created_at).toLocaleString()}</p>
            <p><strong>Last Sign In:</strong> ${new Date(user.last_sign_in_at).toLocaleString()}</p>
        `

        // Fetch venues with associated activities
        const { data: venues, error: venuesError } = await supabaseClient.from('venues').select('*, venue_associated_activities(*)')

        if (venuesError) {
            showMessage('Error loading venues: ' + venuesError.message, true)
            document.getElementById('venues-tbody').innerHTML = '<tr><td colspan="7">Error loading venues</td></tr>'
        } else {
            document.getElementById('venues-count').textContent = venues.length
            const tbody = document.getElementById('venues-tbody')
            tbody.innerHTML = '' // Clear any existing rows
            venues.forEach(venue => {
                const associatedActivities = venue.venue_associated_activities?.map(act => act.activity_type).join(', ') || ''
                const row = document.createElement('tr')
                row.innerHTML = `
                    <td>${venue.id}</td>
                    <td><a href="${window.BASEURL}/venue.html?id=${venue.id}">${venue.location_name}</a></td>
                    <td>${venue.address_1}${venue.address_2 ? ', ' + venue.address_2 : ''}</td>
                    <td>${venue.city}</td>
                    <td>${venue.country}</td>
                    <td>${new Date(venue.created_at).toLocaleString()}</td>
                    <td>${associatedActivities}</td>
                `
                tbody.appendChild(row)
            })
        }

    } catch (error) {
        showMessage('Error loading dashboard data: ' + error.message, true)
        userDataDiv.innerHTML = 'Error loading user data'
        document.getElementById('venues-tbody').innerHTML = '<tr><td colspan="7">Error loading venues</td></tr>'
    }
}
)
