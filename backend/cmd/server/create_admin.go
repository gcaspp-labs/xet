package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/gcaspp-labs/xet/backend/internal/auth"
	"github.com/gcaspp-labs/xet/backend/internal/config"
)

// runCreateAdmin implements "server create-admin -name ... -email ...",
// reading the password from the first line of standard input so it does not
// end up in the shell history.
func runCreateAdmin(args []string) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx := context.Background()
	pool, err := openDatabase(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	fmt.Fprint(os.Stderr, "Senha do administrador: ")
	return createAdmin(ctx, auth.NewService(pool), args, os.Stdin, os.Stdout)
}

func createAdmin(ctx context.Context, svc *auth.Service, args []string, stdin io.Reader, stdout io.Writer) error {
	fs := flag.NewFlagSet("create-admin", flag.ContinueOnError)
	name := fs.String("name", "", "nome do administrador")
	email := fs.String("email", "", "e-mail de login")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*name) == "" || strings.TrimSpace(*email) == "" {
		return errors.New("uso: server create-admin -name \"Nome\" -email email@exemplo.com (senha pela entrada padrão)")
	}

	password, err := bufio.NewReader(stdin).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return fmt.Errorf("ler senha: %w", err)
	}
	password = strings.TrimRight(password, "\r\n")

	user, err := svc.CreateAdmin(ctx, *name, *email, password)
	switch {
	case errors.Is(err, auth.ErrWeakPassword):
		return errors.New("a senha precisa ter no mínimo 8 caracteres, com letra maiúscula, letra minúscula, número e caractere especial")
	case errors.Is(err, auth.ErrPasswordTooLong):
		return errors.New("a senha pode ter no máximo 72 caracteres")
	case errors.Is(err, auth.ErrEmailTaken):
		return fmt.Errorf("já existe um usuário com o e-mail %s", *email)
	case err != nil:
		return err
	}
	_, err = fmt.Fprintf(stdout, "Administrador criado: %s (%s)\n", user.Name, user.Email)
	return err
}
