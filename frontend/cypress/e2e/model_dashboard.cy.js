describe("Model Dashboard", () => {
  before(() => {
    cy.task('reseedDatabase', null, { timeout: 60000 });
  });

  beforeEach(() => {
    cy.loginAsModel();
  });

  it("shows the model dashboard", () => {
    cy.contains("My Schedule").should("be.visible");
  });

  it("shows the model's name in the greeting", () => {
    cy.contains("Hello, Ruth").should("be.visible");
  });

  it("shows confirmed gigs in schedule tab", () => {
    cy.contains("Confirmed Gig").should("be.visible");
  });

  it("can switch to availability tab", () => {
    cy.contains("Manage Availability").click();
    cy.contains("My Gigs (Next 14 Days)").should("be.visible");
  });

  it("can add availability", () => {
    // Add availability directly via API
    cy.request({
      method: 'POST',
      url: 'http://localhost:3000/test_login',
      body: { email: 'ruth@mica.edu' },
      form: true
    }).then(() => {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(15);
      
      cy.request({
        method: 'POST',
        url: 'http://localhost:3000/art_model_availabilities',
        body: {
          art_model_availability: {
            starts_at: new Date(nextMonth.setHours(9, 0, 0)).toISOString(),
            ends_at: new Date(nextMonth.setHours(17, 0, 0)).toISOString()
          }
        },
        withCredentials: true
      }).then((res) => {
        expect(res.status).to.eq(201);
      });
    });

    // Verify it appears on the calendar
    cy.contains("Manage Availability").click();
    cy.get('.fc-event').should("have.length.greaterThan", 0);
  });
});