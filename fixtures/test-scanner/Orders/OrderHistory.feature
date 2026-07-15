@Orders
Feature: Order history

  @26.1
  Scenario: View past orders
    Given a customer with order history
    When the customer opens the order history page
    Then the past orders are listed

  Scenario: Cancel a pending order
    Given a customer has a pending order
    When the customer cancels the order
    Then the order status changes to "Cancelled"
