type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
};

export default function Button({ children, ...props }: ButtonProps) {
    return (
        <button className="rounded bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600" {...props}>
            {children}
        </button>
    );
}
