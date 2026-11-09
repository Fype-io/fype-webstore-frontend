"use client";

import { useState } from "react";
import type { SparkContactFormSettings } from "../sparkConfig";
import { getCurrentStoreId } from "@/lib/client-store-context";
import { getApiErrorMessage, postApi } from "@/lib/client-api";

interface ContactFormProps {
    settings: SparkContactFormSettings;
}

// Port of Fype-E-Commerce-UI's sections/ContactForm.tsx. Submitting sends the
// fields to POST /commerce/contact-owner (crmApp emails the store owner); a
// failure shows a shopper-safe message above the button (getApiErrorMessage,
// never the server's own error text), and the button is disabled while
// sending so one click sends one email. No addable blocks (matches
// THEME_SCHEMA), so no editor per-field click-to-select — the whole section
// is one click target, same as Featured Collection/Product/Collection List.
export default function ContactForm({ settings }: ContactFormProps) {
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        subject: "",
        location: "",
        message: "",
    });

    const showName = settings.fields.includes("Name");
    const showEmail = settings.fields.includes("Email");
    const showPhone = settings.fields.includes("Phone Number");
    const showSubject = settings.fields.includes("Subject");
    const showLocation = settings.fields.includes("Location");
    const showMessage = settings.fields.includes("Message");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData((prevData) => ({
            ...prevData,
            [id]: value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const storeId = getCurrentStoreId();

            if(!storeId) {
                setError("Unable to send your message. Please try again.");
                return;
            }

            setLoading(true);
            setError(null);

            await postApi("/commerce/contact-owner", {
            storeId,
            fields: {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                subject: formData.subject,
                location: formData.location,
                message: formData.message,
            },
        });
            setSubmitted(true);

            setFormData({
                name: "",
                email: "",
                phone: "",
                subject: "",
                location: "",
                message: "",
            });

            setTimeout(() => {
                setSubmitted(false);
            }, 5000);
        } catch (error) {
            setError(
                getApiErrorMessage(
                    error,
                    "Unable to send your message. Please try again."
                )
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <section
            style={{ paddingTop: `${settings.padding_top}px`, paddingBottom: `${settings.padding_bottom}px`, backgroundColor: settings.background_color }}
            className="border-t border-gray-100 py-12 md:py-32"
        >
            <div className="max-w-xl mx-auto px-6">
                <div className="text-center mb-10 md:mb-16">
                    {settings.heading && <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" dangerouslySetInnerHTML={{ __html: settings.heading }} />}
                    {settings.subtext && <div className="text-gray-600 text-lg" dangerouslySetInnerHTML={{ __html: settings.subtext }} />}
                </div>

                {submitted ? (
                    <div className="bg-emerald-50 text-emerald-800 p-6 rounded-xl text-center border border-emerald-100">
                        <div className="font-medium text-lg" dangerouslySetInnerHTML={{ __html: settings.success_message }} />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-gray-100">
                        {(showName || showEmail) && (
                            <div className="grid gap-6 md:grid-cols-2">
                                {showName && (
                                    <div className="space-y-1.5 text-left">
                                        <label htmlFor="name" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Name
                                        </label>
                                        <input
                                            type="text"
                                            id="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                        />
                                    </div>
                                )}
                                {showEmail && (
                                    <div className="space-y-1.5 text-left">
                                        <label htmlFor="email" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {showPhone && (
                            <div className="space-y-1.5 text-left">
                                <label htmlFor="phone" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    id="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                />
                            </div>
                        )}

                        {showSubject && (
                            <div className="space-y-1.5 text-left">
                                <label htmlFor="subject" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Subject
                                </label>
                                <input
                                    type="text"
                                    id="subject"
                                    value={formData.subject}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                />
                            </div>
                        )}

                        {showLocation && (
                            <div className="space-y-1.5 text-left">
                                <label htmlFor="location" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Location
                                </label>
                                <input
                                    type="text"
                                    id="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                                />
                            </div>
                        )}

                        {showMessage && (
                            <div className="space-y-1.5 text-left">
                                <label htmlFor="message" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Message
                                </label>
                                <textarea
                                    id="message"
                                    required
                                    rows={5}
                                    value={formData.message}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all resize-none"
                                />
                            </div>
                        )}

                        {error && (
                            <div role="alert" className="p-3 bg-red-50 text-red-700 rounded-lg text-sm text-left">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-black text-white font-medium py-3.5 rounded-lg hover:bg-gray-800 transition-colors shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {settings.submit_button_label}
                        </button>
                    </form>
                )}
            </div>
        </section>
    );
}
