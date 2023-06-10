document.getElementById('signInForm').addEventListener('submit', signIn);
validateJWT();

/**
 * Validates the JWT token stored in the "token" cookie
 * @returns {Promise<boolean>} True if the JWT is valid, false otherwise
 */
async function validateJWT() {
    const token = getToken();
    if (!token) {
        document.getElementById('signIn').classList.remove('d-none');
        return false;
    }
    var res;
    try {
        res = await fetch(
            'https://01.gritlab.ax/api/graphql-engine/v1/graphql',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({
                    query: 'query { user { id } }',
                }),
            }
        );
    } catch (e) {
        document.cookie = document.cookie.split(';').filter((c) => {
            return !c.startsWith('token');
        });
        document.getElementById('errorMsg').classList.remove('d-none');
        return false;
    }
    const data = await res.json();
    if (data.errors) {
        document.cookie = document.cookie.split(';').filter((c) => {
            return !c.startsWith('token');
        });
        document.getElementById('signIn').classList.remove('d-none');
        return false;
    }
    document.getElementById('signIn').classList.add('d-none');
    showInfo();
    return true;
}

/**
 * Takes the username and password from the form and sends a request to the server to sign in
 *
 * Sets the token cookie if the request is successful
 * @param {Event} e
 * @returns
 */
async function signIn(e) {
    e.preventDefault();
    if (await validateJWT()) {
        return;
    }
    const username = e.target.username.value;
    const password = e.target.password.value;
    const res = await fetch('https://01.gritlab.ax/api/auth/signin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic ' + window.btoa(username + ':' + password),
        },
    });
    if (!res.ok) {
        const err = await res.json();
        document
            .getElementById('signInErrorMsg')
            .getElementById('msg').innerHTML = err.error;
    }
    const data = await res.json();
    document.cookie = `token=${data};`;
    document.getElementById('signIn').classList.add('d-none');
    showInfo();
}

async function showInfo() {
    const token = getToken();
    document.getElementById('content').classList.remove('d-none');
    const res = await fetch(
        'https://01.gritlab.ax/api/graphql-engine/v1/graphql',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token,
            },
            body: JSON.stringify({
                query: 'query {\
                    user {\
                        id\
                        login\
                        attrs\
                        auditRatio\
                        audits {\
                            group {\
                                captainId\
                                captainLogin\
                                path\
                                createdAt\
                                updatedAt\
                                members {\
                                    userId\
                                    userLogin\
                                }\
                            }\
                        }\
                    }\
                    event(where: {path: {_nlike: "%checkpoint%"}}) {\
                        path\
                        id\
                    }\
                    transaction(where: {type: {_eq: "xp"}}, order_by: {createdAt: desc}) {\
                        amount\
                        createdAt\
                        eventId\
                        path\
                    }\
                }',
            }),
        }
    );
    const data = await res.json();
    if (data.errors) {
        console.log(data.errors[0].message);
        return;
    }
    console.log(data.data);
    const event = Object.fromEntries(
        data.data.event.map((e) => [e.id, e.path])
    );
    const transaction = data.data.transaction;
    let total = 0;
    var dates = [];
    let prevDate = new Date(transaction[transaction.length - 1].createdAt)
        .toLocaleString()
        .split(', ')[0];
    transaction.reverse().forEach((t) => {
        const date = new Date(t.createdAt).toLocaleString().split(', ')[0];
        if (date !== prevDate) {
            dates.push(prevDate);
            prevDate = date;
        }
    });
    const xp = {};
    transaction.forEach((t) => {
        const date = new Date(t.createdAt).toLocaleString().split(', ')[0];
        xp[date] = Math.floor(t.amount + total);
        total += t.amount;
    });
    const user = data.data.user[0];
    document.getElementById('contentUsername').innerHTML = user.login;
    document.getElementById('contentId').innerHTML = user.id;
    document.getElementById('contentEmail').innerHTML = user.attrs.email;
    document.getElementById('contentFName').innerHTML = user.attrs.firstName;
    document.getElementById('contentLName').innerHTML = user.attrs.lastName;
    console.log(xp);
    const xpGraph = new Chart('xpGraph', {
        type: 'line',
        data: {
            labels: dates.map((d) => d.split(', ')[0]),
            datasets: [
                {
                    label: 'XP',
                    data: Array.from(Object.values(xp)),
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    tension: 0.5,
                },
            ],
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                },
            },
        },
    });
}

/**
 *   Returns the value of the token cookie
 *
 *   If the cookie is not found, returns undefined
 *   @returns {string | undefined} The value of the token cookie
 */
function getToken() {
    return document.cookie
        .split(';')
        .find((c) => c.startsWith('token'))
        ?.split('=')[1];
}
