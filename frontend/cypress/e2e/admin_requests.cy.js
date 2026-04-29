describe("Admin - Faculty Requests", () => {
  before(() => {
    cy.task('reseedDatabase', null, { timeout: 60000 });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.get('.nav-link').contains('Requests').click();
    cy.contains("Faculty Requests", { timeout: 8000 }).should("be.visible");
    cy.contains("Show All", { timeout: 8000 }).as('showAllBtn');
    cy.get('@showAllBtn').click();
    cy.contains(/Pending \(\d+\)/, { timeout: 8000 }).should("be.visible");
  });

  it("shows the faculty requests page", () => {
    cy.contains("Faculty Requests").should("be.visible");
  });

  it("shows pending requests", () => {
    cy.contains("Pending").should("be.visible");
    cy.contains("Find Match").should("be.visible");
  });

  it("can search for a request", () => {
    cy.get("input[placeholder*='Search']").type("Figure");
    cy.contains("Figure Drawing 101").should("be.visible");
  });

  it("can open Find Match sidebar and see recommended models", () => {
    cy.contains("Find Match").first().click();
    cy.contains("Recommended").should("be.visible");
  });

  it("can book a model from the sidebar", () => {
    cy.task('reseedDatabase', null, { timeout: 60000 });
    cy.loginAsAdmin();
    cy.get('.nav-link').contains('Requests').click();
    cy.contains("Faculty Requests", { timeout: 8000 }).should("be.visible");
    cy.contains("Show All").click();
    cy.contains(/Pending \(\d+\)/, { timeout: 8000 }).should("be.visible");
    cy.contains("Find Match").first().click();
    cy.contains("Recommended").should("be.visible");
    cy.get(".list-group-item").first().click();
    cy.on("window:confirm", () => true);
    cy.contains("Matched").should("be.visible");
  });
});