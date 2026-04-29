describe("Faculty Dashboard", () => {
  before(() => {
    cy.task('reseedDatabase', null, { timeout: 60000 });
  });

  beforeEach(() => {
    cy.loginAsFaculty();
  });

  it("shows the faculty dashboard", () => {
    cy.contains("My Classes").should("be.visible");
  });

  it("shows the new request button", () => {
    cy.contains("New Request").should("be.visible");
  });

  it("can open the new request modal", () => {
    cy.contains("New Request").click();
    cy.contains("Request a Model").should("be.visible");
  });

  it("can submit a new request", () => {
    cy.contains("New Request").click();
    cy.contains("Request a Model").should("be.visible");

    cy.get("input[name='class_name']").type("Test Figure Drawing");
    cy.get("select[name='department']").select("Drawing");

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const format = (d) => d.toISOString().split('T')[0];

    cy.get("input[name='date']").type(format(nextWeek)).blur();
    cy.get("input[name='start_time']").clear().type("09:00").blur();
    cy.get("input[name='end_time']").clear().type("12:00").blur();

    cy.contains("Submit Request").click();
    cy.contains("Request submitted successfully").should("be.visible");
  });

  it("can cancel a pending request", () => {
    cy.contains("Cancel Request").first().click();
    cy.on("window:confirm", () => true);
    cy.contains("Request cancelled").should("be.visible");
  });
});