import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { collection, getDocs, query, where } from "firebase/firestore";
import { MenuCard } from "./MenuCard.jsx";
import { SectionBanner } from "./SectionBanner.jsx";
import { db } from "../firebase";
import { getSectionTone } from "../utils/menuTheme";

export const MenuSection = ({ children, desc, onAddToCart, toppingsMap = {}, index = 0 }) => {
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

    const tone = getSectionTone(index);

    return (
        <div>
            <SectionBanner desc={desc} index={index} count={isLoading || loadError ? null : items.length}>{children}</SectionBanner>
            <ul className="relative z-10 mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 pb-6 overflow-visible grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                {
                    isLoading ? (
                        Array.from({ length: 4 }).map((_, index) => (
                            <li
                                key={`skeleton-${index}`}
                                className="flex sm:flex-col gap-3 rounded-[1.75rem] bg-surface p-2.5 sm:p-3 shadow-[0_10px_30px_-18px_var(--color-ink)]"
                            >
                                <div className="h-28 w-28 sm:h-auto sm:w-full shrink-0 sm:aspect-[4/3] rounded-[1.4rem] bg-primary/10 animate-pulse" />
                                <div className="flex-1 space-y-2.5 py-2 pr-2 sm:px-2">
                                    <div className="h-4 w-3/4 rounded-full bg-primary/10 animate-pulse" />
                                    <div className="h-3 w-full rounded-full bg-primary/5 animate-pulse" />
                                    <div className="mt-4 flex justify-between items-center">
                                        <div className="h-6 w-14 rounded-full bg-primary/10 animate-pulse" />
                                        <div className="h-11 w-11 rounded-full bg-primary/10 animate-pulse" />
                                    </div>
                                </div>
                            </li>
                        ))
                    ) : loadError ? (
                        <li className="col-span-full rounded-3xl bg-fresa p-6 text-sm font-semibold text-fresa-ink">
                            {loadError}
                        </li>
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
                                    tone={tone}
                                />
                            )
                        })
                    )
                }
            </ul>
        </div>
    )
}

MenuSection.propTypes = {
    children: PropTypes.string.isRequired,
    desc: PropTypes.string,
    onAddToCart: PropTypes.func,
    toppingsMap: PropTypes.object,
    index: PropTypes.number,
}
