import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { collection, getDocs, query, where } from "firebase/firestore";
import { MenuCard } from "./MenuCard.jsx";
import { SectionBanner } from "./SectionBanner.jsx";
import { db } from "../firebase";

export const MenuSection = ({ children, desc, onAddToCart, toppingsMap = {} }) => {
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
            } catch {
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 overflow-visible">
                    {
                        isLoading ? (
                            Array.from({ length: 6 }).map((_, index) => (
                                <div
                                    key={`skeleton-${index}`}
                                    className="flex flex-col rounded-2xl border border-amber-50 bg-[#faf6f0] shadow-md overflow-hidden"
                                >
                                    <div className="w-full aspect-[4/3] bg-main-200/40 animate-pulse" />
                                    <div className="flex-1 space-y-2.5 px-4 py-3">
                                        <div className="h-4 w-3/4 rounded-full bg-main-200/40 animate-pulse" />
                                        <div className="h-3 w-full rounded-full bg-main-200/30 animate-pulse" />
                                        <div className="h-3 w-2/3 rounded-full bg-main-200/30 animate-pulse" />
                                        <div className="mt-3 flex justify-between items-center">
                                            <div className="h-6 w-16 rounded-full bg-main-200/40 animate-pulse" />
                                            <div className="h-9 w-24 rounded-full bg-main-200/40 animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : loadError ? (
                            <div className="col-span-full rounded-2xl border border-red-300/20 bg-red-500/10 p-6 text-sm text-red-100">
                                {loadError}
                            </div>
                        ) : (
                            items.map((product) => {
                                const availableToppings = Array.isArray(product.toppingIds)
                                    ? product.toppingIds
                                        .map((tid) => toppingsMap[tid])
                                        .filter(Boolean)
                                    : []
                                return (
                                    <MenuCard
                                        key={product.docId ?? product.id}
                                        name={product.name}
                                        desc={product.desc}
                                        price={product.price}
                                        long_desc={product.long_desc}
                                        image={product.image}
                                        imageUrl={product.imageUrl}
                                        id={product.id}
                                        isActive={product.isActive}
                                        featured={product.featured || false}
                                        popular={product.popular || false}
                                        availableToppings={availableToppings}
                                        optionGroups={Array.isArray(product.optionGroups) ? product.optionGroups : []}
                                        onAddToCart={onAddToCart}
                                    />
                                )
                            })
                        )
                    }
                </div>
            </ul>
        </div>
    )
}

MenuSection.propTypes = {
    children: PropTypes.string.isRequired,
    desc: PropTypes.string,
    onAddToCart: PropTypes.func,
    toppingsMap: PropTypes.object,
}
