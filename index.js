document.getElementById('signInForm').addEventListener('submit', signIn);
validateJWT();
async function validateJWT() {
    const token = document.cookie
        .split(';')
        .find((c) => c.startsWith('token'))
        ?.split('=')[1];
    if (!token) {
        document.getElementById('signIn').classList.remove('d-none');
        return false;
    }
    const res = await fetch(
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
        document.getElementById('errorMsg').getElementById('msg').innerHTML =
            err.error;
    }
    const data = await res.json();
    document.cookie = `token=${data};`;
    document.getElementById('signIn').classList.add('d-none');
    showInfo();
}

async function showInfo() {
    const token = document.cookie
        .split(';')
        .find((c) => c.startsWith('token'))
        ?.split('=')[1];
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
