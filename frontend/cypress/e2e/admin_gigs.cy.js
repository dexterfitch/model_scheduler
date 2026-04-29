describe("Admin - Gig Registry", () => {
  before(() => {
    cy.task('reseedDatabase', null, { timeout: 60000 });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.get('.nav-link').contains('Gigs').click();
    cy.contains("Gig Registry", { timeout: 8000 }).should("be.visible");
    cy.contains("Show All").click();
  });

  it("shows the gig registry page", () => {
    cy.contains("Gig Registry").should("be.visible");
  });

  it("shows confirmed gigs", () => {
    cy.contains("Confirmed").should("be.visible");
  });

  it("can search for a gig", () => {
    cy.get("input[placeholder*='Search']").type("Ruth");
    cy.contains("Ruth").should("be.visible");
  });

  it("can cancel a gig", () => {
    cy.task('reseedDatabase', null, { timeout: 30000 });
    cy.loginAsAdmin();
    cy.get('.nav-link').contains('Gigs').click();
    cy.contains("Gig Registry", { timeout: 8000 }).should("be.visible");
    cy.contains("Show All").click();
    cy.contains("Cancel").first().click();
    cy.on("window:confirm", () => true);
    cy.contains("Cancelled").should("be.visible");
  });
});