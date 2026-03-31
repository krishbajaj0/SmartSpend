import { memo, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

function ExpensePagination({
    totalItems,
    currentPage,
    onPageChange,
}) {
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);

    useEffect(() => {
        if (currentPage > totalPages && totalPages >= 1) {
            onPageChange(totalPages);
        }
    }, [totalPages, currentPage, onPageChange]);

    const handlePrev = useCallback(() => {
        onPageChange(Math.max(1, safePage - 1));
    }, [safePage, onPageChange]);

    const handleNext = useCallback(() => {
        onPageChange(Math.min(totalPages, safePage + 1));
    }, [safePage, totalPages, onPageChange]);

    if (totalItems <= ITEMS_PER_PAGE) {
        return null;
    }

    return (
        <div className="expenses-pagination">
            <button
                className="pagination-btn"
                onClick={handlePrev}
                disabled={safePage <= 1}
                aria-label="Previous page"
            >
                <ChevronLeft size={16} /> Prev
            </button>
            <span className="expenses-pagination-info">
                Page {safePage} of {totalPages}
            </span>
            <button
                className="pagination-btn"
                onClick={handleNext}
                disabled={safePage >= totalPages}
                aria-label="Next page"
            >
                Next <ChevronRight size={16} />
            </button>
        </div>
    );
}

export { ITEMS_PER_PAGE };
export default memo(ExpensePagination);
