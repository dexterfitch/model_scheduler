const API_URL = "http://localhost:3000";

Cypress.Commands.add("loginAs", (email, waitForText = "Admin Dashboard") => {
  cy.request({
    method: "POST",
    url: `${API_URL}/test_login`,
    body: { email },
    form: true,
    withCredentials: true
  }).then((res) => {
    const userId = res.body.id;
    cy.visit(`/login_success/${userId}`);
    cy.contains(waitForText, { timeout: 10000 }).should("be.visible");
  });
});

Cypress.Commands.add("loginAsAdmin", () => {
  cy.loginAs("dfitch@mica.edu", "Admin Dashboard");
});

Cypress.Commands.add("loginAsFaculty", () => {
  cy.loginAs("frank@mica.edu", "My Classes");
});

Cypress.Commands.add("loginAsModel", () => {
  cy.loginAs("ruth@mica.edu", "My Schedule");
});