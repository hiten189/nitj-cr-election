function loadStudentDashboard(email) {

    getApp().innerHTML = `

        <main class="login-page">

            <section class="login-card">

                <h1 class="login-title">

                    Welcome

                </h1>

                <p class="login-subtitle">

                    Logged in as

                </p>

                <p
                    style="
                        text-align:center;
                        font-weight:600;
                        margin-bottom:30px;
                        word-break:break-word;
                    "
                >

                    ${email}

                </p>

                <button id="logout-btn">

                    Logout

                </button>

            </section>

        </main>

    `;

    document
        .getElementById("logout-btn")
        .addEventListener("click", logoutStudent);

}