@Shipping
Feature: Shipping options

  @26.1
  Scenario: Customer selects express shipping
    Given a customer is at checkout
    When the customer selects express shipping
    Then the shipping cost is updated
