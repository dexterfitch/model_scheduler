describe("Admin Dashboard", () => {
  before(() => {
    cy.task('reseedDatabase', null, { timeout: 60000 });
    cy.wait(2000);
  });
  
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it("shows the admin dashboard", () => {
    cy.contains("Admin Dashboard").should("be.visible");
  });

  it("shows pending faculty requests", () => {
    cy.contains("Pending Faculty Requests").should("be.visible");
    cy.contains("Find Match").should("be.visible");
  });

  it("shows today's schedule", () => {
    cy.contains("Today's Schedule").should("be.visible");
  });

  it("can open the Find Match sidebar", () => {
    cy.contains("Find Match").first().click();
    cy.contains("Recommended").should("be.visible");
  });
});