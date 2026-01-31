export const SectionBanner = ({children, desc}) => {
    return (
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 my-6">
            <div className="rounded-2xl px-6 sm:px-10 py-6 sm:py-8 
                            shadow-[inset_1px_3px_10px_rgba(69,26,3,0.10)]">
                <h2 className="text-2xl sm:text-3xl font-bold text-main-800 leading-tight">{children}</h2>
                <p className="mt-2 text-sm sm:text-base text-main-600">{desc}</p>
            </div>
        </div>
    )
}