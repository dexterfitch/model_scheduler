describe("Admin - User Directory", () => {
  before(() => {
    cy.task('reseedDatabase', null, { timeout: 60000 });
    cy.wait(2000);
  });
  
  beforeEach(() => {
    cy.loginAsAdmin();
    cy.get('.nav-link').contains('Directory').click();
    cy.contains("User Directory", { timeout: 8000 }).should("be.visible");
  });

  it("shows the directory page", () => {
    cy.contains("User Directory").should("be.visible");
  });

    it("shows models tab by default", () => {
    cy.contains("Models").should("be.visible");
    cy.get('.tab-pane.active .card, .tab-pane.active tbody tr').should("have.length.greaterThan", 0);
    });

  it("can switch to faculty tab", () => {
    cy.contains("Faculty").click();
    cy.contains("Frank").should("be.visible");
  });

  it("shows model nudity preference badges", () => {
    cy.contains("Nude OK").should("be.visible");
  });

  it("has a View Availability button for models", () => {
    cy.contains("View Availability").should("be.visible");
  });
});