describe("Admin - Calendar", () => {
  before(() => {
    cy.task('reseedDatabase', null, { timeout: 60000 });
    cy.wait(2000);
  });
  
  beforeEach(() => {
    cy.loginAsAdmin();
    cy.get('.nav-link').contains('Calendar').click();
    cy.contains("Master Schedule", { timeout: 8000 }).should("be.visible");
  });

  it("shows the calendar page", () => {
    cy.contains("Master Schedule").should("be.visible");
  });

  it("shows the calendar", () => {
    cy.get('.fc').should("be.visible");
  });

  it("shows upcoming model availability sidebar", () => {
    cy.contains("Upcoming Model Availability").should("be.visible");
  });

  it("shows calendar events", () => {
    cy.get('.fc-event').should("have.length.greaterThan", 0);
  });
});