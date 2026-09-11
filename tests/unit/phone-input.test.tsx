/**
 * The picker and number field emit what gets validated and stored, so these are the
 * cases where the text on screen and the value submitted are not the same thing.
 */
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhoneInput } from "@/components/ui/phone-input";

function Harness({ initial = "", onValue }: { initial?: string; onValue: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <PhoneInput
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

const numberField = () => screen.getByRole("textbox") as HTMLInputElement;
const countryPicker = () => screen.getByLabelText("Country code") as HTMLSelectElement;

describe("PhoneInput", () => {
  it("defaults to India and emits E.164 as the number is typed", () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);

    fireEvent.change(numberField(), { target: { value: "98765 43210" } });

    expect(countryPicker().value).toBe("IN");
    expect(onValue).toHaveBeenLastCalledWith("+919876543210");
  });

  it("re-emits the same digits under a new country when the picker changes", () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);

    fireEvent.change(numberField(), { target: { value: "2079460958" } });
    fireEvent.change(countryPicker(), { target: { value: "GB" } });

    expect(onValue).toHaveBeenLastCalledWith("+442079460958");
  });

  it("takes the country from a pasted or autofilled international number", () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);

    fireEvent.change(numberField(), { target: { value: "+44 20 7946 0958" } });

    expect(countryPicker().value).toBe("GB");
    expect(numberField().value).toBe("2079460958");
    expect(onValue).toHaveBeenLastCalledWith("+442079460958");
  });

  it("keeps what the user typed on screen, trunk zero included, while submitting E.164", () => {
    const onValue = vi.fn();
    render(<Harness initial="+442079460958" onValue={onValue} />);

    fireEvent.change(numberField(), { target: { value: "020 7946 0958" } });

    expect(numberField().value).toBe("020 7946 0958");
    expect(onValue).toHaveBeenLastCalledWith("+442079460958");
  });

  it("shows a stored number split into picker and digits", () => {
    render(<Harness initial="+14155552671" onValue={vi.fn()} />);
    expect(countryPicker().value).toBe("US");
    expect(numberField().value).toBe("4155552671");
  });

  it("re-seeds when the form sets the value from outside — a reset or a restored draft", () => {
    const { rerender } = render(<PhoneInput value="" onChange={vi.fn()} />);
    rerender(<PhoneInput value="+442079460958" onChange={vi.fn()} />);

    expect(countryPicker().value).toBe("GB");
    expect(numberField().value).toBe("2079460958");
  });
});
