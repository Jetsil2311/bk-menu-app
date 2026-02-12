import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { MenuCard } from "./MenuCard.jsx";
import { SectionBanner } from "./SectionBanner.jsx";
import { db } from "../firebase";

export const MenuSection = ({ children, desc, onAddToCart }) => {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        let isActive = true;

        const loadProducts = async () => {
            setIsLoading(true);
            setLoadError("");
            try {
                const productsRef = collection(db, "products");
                const productsQuery = query(productsRef, where("section", "==", children));
                const snapshot = await getDocs(productsQuery);
                const results = snapshot.docs.map((doc) => ({
                    id: doc.data()?.id ?? doc.id,
                    docId: doc.id,
                    ...doc.data(),
                }));
                if (isActive) {
                    setItems(results);
                }
            } catch (error) {
                if (isActive) {
                    setLoadError("No se pudieron cargar los productos.");
                }
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        };

        if (children) {
            loadProducts();
        }

        return () => {
            isActive = false;
        };
    }, [children]);

    return (
        <div>
            <SectionBanner desc={desc}>{children}</SectionBanner>
            <ul className="relative z-10 mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 pb-10 overflow-visible">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 overflow-visible">
                    {
                        isLoading ? (
                            Array.from({ length: 6 }).map((_, index) => (
                                <div
                                    key={`skeleton-${index}`}
                                    className="flex items-center gap-3 rounded-xl bg-light-200/70 px-4 py-4 shadow-[inset_1px_1px_5px_rgba(69,26,3,0.10)]"
                                >
                                    <div className="h-28 w-28 shrink-0 rounded-xl bg-main-200/40 animate-pulse" />
                                    <div className="flex-1 space-y-3">
                                        <div className="h-5 w-2/3 rounded-full bg-main-200/40 animate-pulse" />
                                        <div className="h-4 w-1/2 rounded-full bg-main-200/40 animate-pulse" />
                                        <div className="h-4 w-24 rounded-full bg-main-200/40 animate-pulse" />
                                        <div className="h-8 w-40 rounded-full bg-main-200/40 animate-pulse" />
                                    </div>
                                </div>
                            ))
                        ) : loadError ? (
                            <div className="col-span-full rounded-2xl border border-red-300/20 bg-red-500/10 p-6 text-sm text-red-100">
                                {loadError}
                            </div>
                        ) : (
                            items.map((product) => (
                                <MenuCard
                                    key={product.docId ?? product.id}
                                    name={product.name}
                                    desc={product.desc}
                                    price={product.price}
                                    long_desc={product.long_desc}
                                    flavors={product.flavors ? product.flavors : null}
                                    image={product.image}
                                    imageUrl={product.imageUrl}
                                    id={product.id}
                                    isActive={product.isActive}
                                    onAddToCart={onAddToCart}
                                />
                            ))
                        )
                    }
                </div>
            </ul>
        </div>
    )
}
