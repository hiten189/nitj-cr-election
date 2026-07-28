function renderLoginScreen() {

    getApp().innerHTML = `

        <main class="login-page">

            <section class="login-card">

                <h1 class="login-title">

                    IPE Voting System

                </h1>

                <p class="login-subtitle">

                    Sign in using your official NIT email address

                </p>

                <div class="form-group">

                    <label for="email-input">

                        Official NIT Email Address

                    </label>

                    <input
                        id="email-input"
                        type="email"
                        placeholder="example.ip.25@nitj.ac.in"
                        autocomplete="email"
                    >

                    <p id="email-error" class="error-message"></p>

                </div>

                <button id="continue-btn">

                    Continue

                </button>

            </section>

        </main>

    `;

}