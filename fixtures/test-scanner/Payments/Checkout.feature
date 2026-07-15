@Payments
Feature: Checkout
  As a customer
  I want to check out my cart
  So that I can complete my purchase

  @26.1 @Smoke
  Scenario: Successful checkout with saved card
    Given a customer has items in the cart
    When the customer checks out with a saved card
    Then the order is confirmed

  @26.2
  Scenario: Checkout fails with an expired card
    Given a customer has items in the cart
    When the customer checks out with an expired card
    Then the checkout is rejected

  @26.1 @Regression
  Scenario Outline: Checkout supports multiple currencies
    Given a customer has items in the cart priced in "<currency>"
    When the customer checks out
    Then the order total is shown in "<currency>"

    Examples:
      | currency |
      | USD      |
      | EUR      |
