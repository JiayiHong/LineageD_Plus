context('defaultDataset', () => {
  beforeEach(() => {
    cy.visit('http://localhost:1234')
  })

  it('Can select default dataset with 16 cells', () => {
    cy.get('[data-cy=datasets-dropdown]').invoke('show')
    cy.get('[data-cy=sample-datasets-dropdown]').invoke('show')
    cy.get('[data-cy=dataset-16]').click()
    cy.get('[data-cy=cell3d-slider-svg]').should('exist')
    cy.get('[data-cy=tree-mainsvg-g]').should('exist')
  })

})