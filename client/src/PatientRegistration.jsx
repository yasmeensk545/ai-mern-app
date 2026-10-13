import { useState } from "react";
import { UserPlus } from "lucide-react";
import { API_BASE_URL, parseApiResponse } from "./api";
import DigitalHealthCard from "./DigitalHealthCard";

export default function PatientRegistration({ token, onRegistered }) {
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "",
    village: "",
  });
  const [message, setMessage] = useState("");
  const [registeredPatient, setRegisteredPatient] = useState(null);
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setRegisteredPatient(null);

    if (!token) {
      setMessage("Please log in as a health worker first.");
      return;
    }

    const age = Number(form.age);

    if (
      !form.name.trim() ||
      !Number.isInteger(age) ||
      age < 0 ||
      age > 130 ||
      !["Male", "Female", "Other"].includes(form.gender) ||
      !form.village.trim()
    ) {
      setMessage("Please enter valid patient details.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/patients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          age,
          gender: form.gender,
          village: form.village.trim(),
        }),
      });
      const data = await parseApiResponse(response);

      if (!data.patient?.healthId) {
        throw new Error("Registration response did not contain a Health ID.");
      }

      setRegisteredPatient(data.patient);
      setForm({
        name: "",
        age: "",
        gender: "",
        village: "",
      });
      onRegistered?.();
    } catch (error) {
      setMessage(error.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="registration">
      <h2 className="registration-heading">
        <UserPlus aria-hidden="true" size={22} />
        Patient Registration
      </h2>

      <p>Enter the patient's details to generate a unique Health ID and QR code.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="patient-name">Patient Name</label>
        <input
          id="patient-name"
          type="text"
          name="name"
          placeholder="Enter patient name"
          value={form.name}
          onChange={handleChange}
          maxLength={100}
          autoComplete="name"
          required
        />

        <label htmlFor="patient-age">Age</label>
        <input
          id="patient-age"
          type="number"
          name="age"
          placeholder="Enter age"
          min="0"
          max="130"
          step="1"
          value={form.age}
          onChange={handleChange}
          required
        />

        <label htmlFor="patient-gender">Gender</label>
        <select
          id="patient-gender"
          name="gender"
          value={form.gender}
          onChange={handleChange}
          required
        >
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>

        <label htmlFor="patient-village">Village</label>
        <input
          id="patient-village"
          type="text"
          name="village"
          placeholder="Enter village name"
          value={form.village}
          onChange={handleChange}
          maxLength={100}
          autoComplete="address-level2"
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Registering..." : "Register Patient"}
        </button>
      </form>

      {message && <p role="alert" className="error-message">{message}</p>}

      {registeredPatient && (
        <DigitalHealthCard
          healthId={registeredPatient.healthId}
          patient={registeredPatient}
        />
      )}
    </section>
  );
}
