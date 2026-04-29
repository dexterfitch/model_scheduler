describe("Admin - Reports", () => {
  before(() => {
    cy.task('reseedDatabase', null, { timeout: 60000 });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.get('.nav-link').contains('Reports').click();
    cy.contains("Reports", { timeout: 8000 }).should("be.visible");
  });

  it("shows the reports page", () => {
    cy.contains("Model Hours Report").should("be.visible");
  });

  it("shows date range inputs", () => {
    cy.get('input[type="date"]').should("have.length", 2);
  });

  it("can generate a report", () => {
    cy.task('reseedDatabase', null, { timeout: 60000 });
    cy.loginAsAdmin();
    cy.get('.nav-link').contains('Reports').click();
    cy.contains("Model Hours Report", { timeout: 8000 }).should("be.visible");

    const threeWeeksAgo = new Date();
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const format = (d) => d.toISOString().split('T')[0];

    cy.get('input[type="date"]').first().clear().type(format(threeWeeksAgo)).blur();
    cy.get('input[type="date"]').last().clear().type(format(tomorrow)).blur();
    cy.contains("Generate Report").click();
    cy.contains("Ruth Model", { timeout: 8000 }).should("be.visible");
  });

  it("shows no results message for empty date range", () => {
    cy.get('input[type="date"]').first().type("2000-01-01");
    cy.get('input[type="date"]').last().type("2000-01-31");
    cy.contains("Generate Report").click();
    cy.contains("No gigs found").should("be.visible");
  });
});