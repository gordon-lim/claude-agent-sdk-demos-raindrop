#!/usr/bin/env python3
"""
A simple calculator that supports basic arithmetic operations.
"""


def add(a: float, b: float) -> float:
    """Add two numbers."""
    return a + b


def subtract(a: float, b: float) -> float:
    """Subtract b from a."""
    return a - b


def multiply(a: float, b: float) -> float:
    """Multiply two numbers."""
    return a * b


def divide(a: float, b: float) -> float:
    """Divide a by b."""
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b


def power(a: float, b: float) -> float:
    """Raise a to the power of b."""
    return a ** b


def get_number(prompt: str) -> float:
    """Get a valid number from user input."""
    while True:
        try:
            return float(input(prompt))
        except ValueError:
            print("Invalid input. Please enter a valid number.")


def display_menu():
    """Display the calculator menu."""
    print("\n" + "=" * 30)
    print("       CALCULATOR")
    print("=" * 30)
    print("1. Add (+)")
    print("2. Subtract (-)")
    print("3. Multiply (*)")
    print("4. Divide (/)")
    print("5. Power (^)")
    print("6. Exit")
    print("=" * 30)


def main():
    """Main function to run the calculator."""
    operations = {
        "1": ("Addition", add, "+"),
        "2": ("Subtraction", subtract, "-"),
        "3": ("Multiplication", multiply, "*"),
        "4": ("Division", divide, "/"),
        "5": ("Power", power, "^"),
    }

    print("Welcome to the Calculator!")

    while True:
        display_menu()
        choice = input("Select an operation (1-6): ").strip()

        if choice == "6":
            print("Thank you for using the calculator. Goodbye!")
            break

        if choice not in operations:
            print("Invalid choice. Please select 1-6.")
            continue

        name, operation, symbol = operations[choice]

        print(f"\n--- {name} ---")
        num1 = get_number("Enter first number: ")
        num2 = get_number("Enter second number: ")

        try:
            result = operation(num1, num2)
            print(f"\nResult: {num1} {symbol} {num2} = {result}")
        except ValueError as e:
            print(f"\nError: {e}")


if __name__ == "__main__":
    main()
