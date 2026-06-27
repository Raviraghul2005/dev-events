'use client'

import { useState } from "react"
import { createBooking } from "@/lib/actions/booking.actions";
import posthog from "posthog-js";

const BookEvent = ({ eventId, slug }: { eventId: string, slug:string }) => {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        const {success} = await createBooking({eventId,slug,email})

        if(success){
            setSubmitted(true)
            posthog.capture('event_booked', {eventId, slug, email})
        }else{
            console.error('Booking Creation Failed ')
            posthog.captureException('Booking Creation Failed ')
        }
        try {
            const response = await fetch("/api/bookings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ eventId, email }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message ?? "Booking failed.");
            }

            setSubmitted(true);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Booking failed.");
        } finally {
            setIsSubmitting(false);
        }
    }

  return (
    <div id="book-event">
        {submitted ?(
            <p className="text-sm">Thank you for signing Up</p>
        ):
        (
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="email">Email address</label>
                    <input 
                    type="email" 
                    value={email} 
                    onChange={(e)=> setEmail(e.target.value)}
                    id="email"
                    placeholder="Enter your Email address"
                    required/>
                </div>

                {error && <p className="text-sm">{error}</p>}

                <button type="submit" className="button-submit" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit"}
                </button>
            </form>
        )} 
    </div>
  )
}

export default BookEvent
